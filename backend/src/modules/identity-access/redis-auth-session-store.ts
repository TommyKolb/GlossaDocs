import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";

import type { AuthSession, AuthSessionStore } from "./auth-session-store.js";

interface RedisAuthSessionStoreOptions {
  redisUrl: string;
  keyPrefix?: string;
}

interface StoredSession {
  accessToken: string;
  expiresAt: number;
}

export class RedisAuthSessionStore implements AuthSessionStore {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  public constructor(options: RedisAuthSessionStoreOptions) {
    this.redis = new Redis(options.redisUrl, { lazyConnect: false });
    this.keyPrefix = options.keyPrefix ?? "glossadocs:session:";
  }

  private key(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  public async create(args: { accessToken: string; ttlSeconds: number }): Promise<AuthSession> {
    const id = randomUUID();
    const expiresAt = Date.now() + args.ttlSeconds * 1000;
    const record: StoredSession = {
      accessToken: args.accessToken,
      expiresAt
    };

    await this.redis.set(this.key(id), JSON.stringify(record), "EX", args.ttlSeconds);
    return { id, accessToken: args.accessToken, expiresAt };
  }

  public async get(sessionId: string): Promise<AuthSession | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) {
      return null;
    }

    let parsed: StoredSession | null = null;
    try {
      parsed = JSON.parse(raw) as StoredSession;
    } catch {
      await this.redis.del(this.key(sessionId));
      return null;
    }

    if (!parsed || parsed.expiresAt <= Date.now()) {
      await this.redis.del(this.key(sessionId));
      return null;
    }

    return {
      id: sessionId,
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt
    };
  }

  public async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  public async healthCheck(): Promise<void> {
    const response = await this.redis.ping();
    if (response !== "PONG") {
      throw new Error("Redis ping failed");
    }
  }
}
