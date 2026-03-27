import { describe, expect, it } from "vitest";

import { getConfig } from "../../src/shared/config.js";

describe("getConfig", () => {
  it("applies defaults when only required process fields are absent", () => {
    const env = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
    const cfg = getConfig(env);
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.AUTH_SESSION_TTL_SECONDS).toBe(3600);
    expect(cfg.AUTH_SESSION_SECURE_COOKIE).toBe(false);
    expect(cfg.AUTH_SESSION_STORE).toBe("memory");
    expect(cfg.AUTH_SESSION_COOKIE_NAME).toBe("glossadocs_session");
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
});
