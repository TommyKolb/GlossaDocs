import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseSslFileAccess } from "../../src/shared/db.js";
import {
  connectionStringOmitLibpqSslParams,
  databaseUrlUsesTls,
  resolveDatabaseSslOptions
} from "../../src/shared/db.js";

describe("connectionStringOmitLibpqSslParams", () => {
  it("removes sslmode while preserving host, db, and other query params", () => {
    const input =
      "postgresql://u:p@some.rds.amazonaws.com:5432/glossadocs?sslmode=require&application_name=test";
    expect(connectionStringOmitLibpqSslParams(input)).toBe(
      "postgresql://u:p@some.rds.amazonaws.com:5432/glossadocs?application_name=test"
    );
  });

  it("returns the string unchanged when no SSL query params are present", () => {
    const s = "postgres://localhost:5432/glossadocs";
    expect(connectionStringOmitLibpqSslParams(s)).toBe(s);
  });
});

describe("databaseUrlUsesTls", () => {
  it("is false for typical local Postgres URLs", () => {
    expect(databaseUrlUsesTls("postgres://postgres:postgres@localhost:5432/glossadocs")).toBe(false);
  });

  it("is true when sslmode=require is present", () => {
    expect(
      databaseUrlUsesTls(
        "postgres://user:pass@host.rds.amazonaws.com:5432/db?sslmode=require"
      )
    ).toBe(true);
  });

  it("is true when hostname is an RDS endpoint", () => {
    expect(databaseUrlUsesTls("postgres://user:pass@foo.bar.rds.amazonaws.com:5432/db")).toBe(true);
  });
});

describe("resolveDatabaseSslOptions", () => {
  const tlsUrl = "postgres://user:pass@host.rds.amazonaws.com:5432/db?sslmode=require";

  const fsNoBundle: DatabaseSslFileAccess = {
    existsSync: () => false,
    readFileSync: () => ""
  };

  it("returns undefined when TLS is not required", () => {
    expect(
      resolveDatabaseSslOptions("postgres://localhost:5432/db", {
        appEnv: "dev",
        databaseTlsInsecure: false
      })
    ).toBeUndefined();
  });

  it("loads CA from RDS_CA_BUNDLE_PATH when the file exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "glossa-ca-"));
    const pemPath = join(dir, "ca.pem");
    writeFileSync(pemPath, "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n");

    const ssl = resolveDatabaseSslOptions(tlsUrl, {
      appEnv: "dev",
      rdsCaBundlePath: pemPath,
      databaseTlsInsecure: false
    });

    expect(ssl).toEqual({
      ca: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n",
      rejectUnauthorized: true
    });
  });

  it("throws when RDS_CA_BUNDLE_PATH is set but the file is missing", () => {
    expect(() =>
      resolveDatabaseSslOptions(tlsUrl, {
        appEnv: "dev",
        rdsCaBundlePath: join(tmpdir(), "missing-bundle.pem"),
        databaseTlsInsecure: false
      })
    ).toThrow(/RDS_CA_BUNDLE_PATH is set but file not found/);
  });

  it("throws in prod when the default bundle path is unavailable", () => {
    expect(() =>
      resolveDatabaseSslOptions(
        tlsUrl,
        {
          appEnv: "prod",
          databaseTlsInsecure: false
        },
        fsNoBundle
      )
    ).toThrow(/DATABASE_TLS_TRUST/);
  });

  it("throws in dev when TLS is required, bundle is missing, and insecure is off", () => {
    expect(() =>
      resolveDatabaseSslOptions(
        tlsUrl,
        {
          appEnv: "dev",
          databaseTlsInsecure: false
        },
        fsNoBundle
      )
    ).toThrow(/DATABASE_TLS_TRUST/);
  });

  it("allows unverified TLS in dev only when DATABASE_TLS_INSECURE is effective", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ssl = resolveDatabaseSslOptions(
      tlsUrl,
      {
        appEnv: "dev",
        databaseTlsInsecure: true
      },
      fsNoBundle
    );

    expect(ssl).toEqual({ rejectUnauthorized: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
