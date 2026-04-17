import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectionOptions } from "tls";
import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

/** Vendored from https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem — see backend/certs/README.md */
const RDS_CA_FILE = join("certs", "rds-global-bundle.pem");

function resolveRdsCaPath(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const pathFromBackendRoot = join(here, "..", "..", RDS_CA_FILE);
  if (existsSync(pathFromBackendRoot)) {
    return pathFromBackendRoot;
  }
  return undefined;
}

/**
 * TLS for PostgreSQL on Amazon RDS: Node does not trust the RDS chain without the AWS CA bundle.
 * Bundle is public (not a secret); refresh when AWS RDS SSL docs announce CA rotation.
 */
function sslOptionsForDatabaseUrl(databaseUrl: string): ConnectionOptions | undefined {
  const usesTls =
    /sslmode=require/i.test(databaseUrl) ||
    /\.rds\.amazonaws\.com/i.test(databaseUrl) ||
    /sslmode=verify/i.test(databaseUrl);
  if (!usesTls) {
    return undefined;
  }

  const caPath = resolveRdsCaPath();
  if (caPath) {
    return {
      ca: readFileSync(caPath, "utf8"),
      rejectUnauthorized: true
    };
  }

  return { rejectUnauthorized: false };
}

export function getDbPool(databaseUrl: string): Pool {
  if (pool) {
    return pool;
  }

  const ssl = sslOptionsForDatabaseUrl(databaseUrl);

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
