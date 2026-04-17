import { existsSync, readFileSync } from "node:fs";
import type { PathLike } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectionOptions } from "tls";
import { Pool, type QueryResultRow } from "pg";

import { getConfig } from "./config.js";

let pool: Pool | null = null;

/** Vendored from https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem — see backend/certs/README.md */
const RDS_CA_FILE = join("certs", "rds-global-bundle.pem");

function resolveDefaultRdsCaPath(fsSync: Pick<typeof import("node:fs"), "existsSync"> = { existsSync }): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const pathFromBackendRoot = join(here, "..", "..", RDS_CA_FILE);
  if (fsSync.existsSync(pathFromBackendRoot)) {
    return pathFromBackendRoot;
  }
  return undefined;
}

/**
 * Returns true when the pool should use TLS options for Amazon RDS / sslmode.
 * Prefer `sslmode=require` (or verify-full) in DATABASE_URL; `.rds.amazonaws.com` is a hint for pg SSL
 * when the hostname is RDS but sslmode may appear in different forms depending on tooling.
 */
export function databaseUrlUsesTls(databaseUrl: string): boolean {
  return (
    /sslmode=require/i.test(databaseUrl) ||
    /sslmode=verify/i.test(databaseUrl) ||
    /\.rds\.amazonaws\.com/i.test(databaseUrl)
  );
}

function resolveRdsCaFilePath(
  explicitPath: string | undefined,
  fsSync: Pick<typeof import("node:fs"), "existsSync"> = { existsSync }
): string | undefined {
  if (explicitPath?.trim()) {
    const p = explicitPath.trim();
    if (fsSync.existsSync(p)) {
      return p;
    }
    throw new Error(`DATABASE_TLS_TRUST: RDS_CA_BUNDLE_PATH is set but file not found: ${p}`);
  }
  return resolveDefaultRdsCaPath(fsSync);
}

export type DatabaseSslContext = {
  appEnv: "dev" | "prod";
  rdsCaBundlePath?: string | undefined;
  databaseTlsInsecure: boolean;
};

/** Narrow fs surface for TLS tests and injection (avoids readFileSync overload resolution issues). */
export type DatabaseSslFileAccess = {
  existsSync(path: PathLike): boolean;
  readFileSync(path: PathLike, encoding: BufferEncoding): string;
};

/**
 * TLS for PostgreSQL on Amazon RDS: Node does not trust the RDS chain without the AWS CA bundle.
 * Bundle is public (not a secret); refresh when AWS RDS SSL docs announce CA rotation.
 */
export function resolveDatabaseSslOptions(
  databaseUrl: string,
  ctx: DatabaseSslContext,
  fsSync: DatabaseSslFileAccess = { existsSync, readFileSync }
): ConnectionOptions | undefined {
  if (!databaseUrlUsesTls(databaseUrl)) {
    return undefined;
  }

  const caPath = resolveRdsCaFilePath(ctx.rdsCaBundlePath, fsSync);

  if (caPath) {
    return {
      ca: fsSync.readFileSync(caPath, "utf8"),
      rejectUnauthorized: true
    };
  }

  if (ctx.appEnv === "prod") {
    throw new Error(
      "DATABASE_TLS_TRUST: TLS is required for this DATABASE_URL but the RDS CA bundle was not found. " +
        "Ensure backend/certs/rds-global-bundle.pem is deployed or set RDS_CA_BUNDLE_PATH to a PEM file."
    );
  }

  if (ctx.databaseTlsInsecure) {
    console.warn(
      "DATABASE_TLS_TRUST: connecting without TLS certificate verification (DATABASE_TLS_INSECURE=true). " +
        "Use only for local debugging; provide the RDS CA bundle for verified connections."
    );
    return { rejectUnauthorized: false };
  }

  throw new Error(
    "DATABASE_TLS_TRUST: TLS is required for this DATABASE_URL but the RDS CA bundle was not found. " +
      "For dev-only testing you may set DATABASE_TLS_INSECURE=true, or set RDS_CA_BUNDLE_PATH to the PEM file."
  );
}

export function getDbPool(databaseUrl: string): Pool {
  if (pool) {
    return pool;
  }

  const cfg = getConfig();
  const ssl = resolveDatabaseSslOptions(databaseUrl, {
    appEnv: cfg.APP_ENV,
    rdsCaBundlePath: cfg.RDS_CA_BUNDLE_PATH,
    databaseTlsInsecure: cfg.DATABASE_TLS_INSECURE ?? false
  });

  pool = new Pool({
    connectionString: databaseUrl,
    ...(ssl ? { ssl } : {})
  });

  return pool;
}

export async function queryDb<T extends QueryResultRow>(
  databaseUrl: string,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const activePool = getDbPool(databaseUrl);
  const result = await activePool.query<T>(text, params);
  return result.rows;
}
