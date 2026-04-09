import { describe, expect, it } from "vitest";

import { getConfig } from "../../src/shared/config.js";

describe("getConfig", () => {
  it("applies defaults when only required process fields are absent", () => {
    const env = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
    const cfg = getConfig(env);
    expect(cfg.APP_ENV).toBe("dev");
    expect(cfg.AUTH_PROVIDER).toBe("keycloak");
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.AUTH_SESSION_TTL_SECONDS).toBe(3600);
    expect(cfg.AUTH_SESSION_SECURE_COOKIE).toBe(false);
    expect(cfg.AUTH_SESSION_STORE).toBe("memory");
    expect(cfg.AUTH_SESSION_COOKIE_NAME).toBe("glossadocs_session");
    expect(cfg.API_BODY_LIMIT_BYTES).toBe(15 * 1024 * 1024);
  });

  it("coerces API_PORT and AUTH_SESSION_TTL_SECONDS from strings", () => {
    const cfg = getConfig({
      NODE_ENV: "test",
      API_PORT: "9000",
      AUTH_SESSION_TTL_SECONDS: "7200"
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.API_PORT).toBe(9000);
    expect(cfg.AUTH_SESSION_TTL_SECONDS).toBe(7200);
  });

  it.each([
    ["true", true],
    ["1", true],
    ["yes", true],
    ["TRUE", true],
    [" false ", false],
    ["0", false],
    ["no", false]
  ])("parses AUTH_SESSION_SECURE_COOKIE %s as %s", (raw, expected) => {
    const cfg = getConfig({
      NODE_ENV: "test",
      AUTH_SESSION_SECURE_COOKIE: raw
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.AUTH_SESSION_SECURE_COOKIE).toBe(expected);
  });

  it("throws with Zod message when AUTH_SESSION_SECURE_COOKIE is not a boolean", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "test",
        AUTH_SESSION_SECURE_COOKIE: "maybe"
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/Invalid environment configuration/);
  });

  it("throws when NODE_ENV is not a valid enum value", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "staging"
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/Invalid environment configuration/);
  });

  it("throws when API_PORT is not a positive integer", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "test",
        API_PORT: "-1"
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/Invalid environment configuration/);
  });

  it("accepts AUTH_SESSION_STORE redis", () => {
    const cfg = getConfig({
      NODE_ENV: "test",
      AUTH_SESSION_STORE: "redis",
      REDIS_URL: "redis://127.0.0.1:6379"
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.AUTH_SESSION_STORE).toBe("redis");
    expect(cfg.REDIS_URL).toBe("redis://127.0.0.1:6379");
  });

  it("defaults to prod app env and cognito provider when NODE_ENV=production", () => {
    const cfg = getConfig({
      NODE_ENV: "production",
      AUTH_SESSION_SECURE_COOKIE: "true",
      AUTH_SESSION_STORE: "redis",
      REDIS_URL: "redis://127.0.0.1:6379",
      CORS_ALLOWED_ORIGINS: "https://app.example.com",
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "us-east-1_abc123",
      COGNITO_CLIENT_ID: "client123"
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.APP_ENV).toBe("prod");
    expect(cfg.AUTH_PROVIDER).toBe("cognito");
    expect(cfg.OIDC_ISSUER_URL).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123");
    expect(cfg.OIDC_AUDIENCE).toBe("client123");
  });

  it("throws when NODE_ENV=production is paired with APP_ENV=dev", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "production",
        APP_ENV: "dev"
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/CONFIG_ENV_MISMATCH/);
  });

  it("throws when APP_ENV=prod uses insecure cookie settings", () => {
    expect(() =>
      getConfig({
        NODE_ENV: "production",
        APP_ENV: "prod",
        CORS_ALLOWED_ORIGINS: "https://app.example.com",
        AUTH_SESSION_SECURE_COOKIE: "false",
        AUTH_SESSION_STORE: "redis",
        REDIS_URL: "redis://127.0.0.1:6379",
        COGNITO_REGION: "us-east-1",
        COGNITO_USER_POOL_ID: "us-east-1_abc123",
        COGNITO_CLIENT_ID: "client123"
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(/CONFIG_AUTH_COOKIE_INSECURE/);
  });
});
