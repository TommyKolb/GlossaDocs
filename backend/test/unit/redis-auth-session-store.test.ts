import { describe, expect, it, vi } from "vitest";

vi.mock("ioredis", () => {
  class MockRedis {
    private readonly values = new Map<string, string>();

    public async set(key: string, value: string): Promise<"OK"> {
      this.values.set(key, value);
      return "OK";
    }

    public async get(key: string): Promise<string | null> {
      return this.values.get(key) ?? null;
    }

    public async del(key: string): Promise<number> {
      this.values.delete(key);
      return 1;
    }

    public async ping(): Promise<string> {
      return "PONG";
    }

    public async quit(): Promise<"OK"> {
      return "OK";
    }

    public readStoredValue(key: string): string | undefined {
      return this.values.get(key);
    }
  }

  return {
    Redis: MockRedis
  };
});

import { RedisAuthSessionStore } from "../../src/modules/identity-access/redis-auth-session-store.js";

describe("RedisAuthSessionStore", () => {
  it("stores plaintext token when encryption key is not configured", async () => {
    const store = new RedisAuthSessionStore({ redisUrl: "redis://example" });
    const created = await store.create({ accessToken: "plain-token", ttlSeconds: 60 });
    const redis = (store as any).redis as { readStoredValue: (key: string) => string | undefined };
    const raw = redis.readStoredValue(`glossadocs:session:${created.id}`);
    expect(raw).toContain("plain-token");
  });

  it("encrypts token payload when encryption key is configured", async () => {
    const store = new RedisAuthSessionStore({
      redisUrl: "redis://example",
      encryptionKey: "test-session-encryption-key"
    });
    const created = await store.create({ accessToken: "secret-token", ttlSeconds: 60 });
    const redis = (store as any).redis as { readStoredValue: (key: string) => string | undefined };
    const raw = redis.readStoredValue(`glossadocs:session:${created.id}`);
    expect(raw).toBeDefined();
    expect(raw).not.toContain("secret-token");

    const loaded = await store.get(created.id);
    expect(loaded?.accessToken).toBe("secret-token");
  });
});
