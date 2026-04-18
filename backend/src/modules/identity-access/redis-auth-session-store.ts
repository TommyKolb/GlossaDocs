import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { Redis } from "ioredis";

import type { AuthSession, AuthSessionStore } from "./auth-session-store.js";

interface RedisAuthSessionStoreOptions {
  redisUrl: string;
  keyPrefix?: string;
  encryptionKey?: string;
}

interface StoredSession {
  accessToken?: string;
  encryptedAccessToken?: EncryptedStoredSession;
  expiresAt: number;
}

interface EncryptedStoredSession {
  cipherText: string;
  iv: string;
  authTag: string;
}

export class RedisAuthSessionStore implements AuthSessionStore {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly tokenEncryptionKey: Buffer | null;

  public constructor(options: RedisAuthSessionStoreOptions) {
    this.redis = new Redis(options.redisUrl, { lazyConnect: false });
    this.keyPrefix = options.keyPrefix ?? "glossadocs:session:";
    this.tokenEncryptionKey = options.encryptionKey
      ? createHash("sha256").update(options.encryptionKey, "utf8").digest()
      : null;
  }

  private key(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  private encryptToken(accessToken: string): EncryptedStoredSession | null {
    if (!this.tokenEncryptionKey) {
      return null;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.tokenEncryptionKey, iv);
    const cipherText = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      cipherText: cipherText.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64")
    };
  }

  private decryptToken(encrypted: EncryptedStoredSession): string {
    if (!this.tokenEncryptionKey) {
      throw new Error("Session encryption key missing");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.tokenEncryptionKey,
      Buffer.from(encrypted.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encrypted.cipherText, "base64")),
      decipher.final()
    ]);
    return plain.toString("utf8");
  }

  private toStoredSession(args: { accessToken: string; expiresAt: number }): StoredSession {
    const encrypted = this.encryptToken(args.accessToken);
    if (encrypted) {
      return {
        encryptedAccessToken: encrypted,
        expiresAt: args.expiresAt
      };
    }
    return {
      accessToken: args.accessToken,
      expiresAt: args.expiresAt
    };
  }

  private fromStoredSession(sessionId: string, parsed: StoredSession): AuthSession {
    if (parsed.accessToken) {
      return {
        id: sessionId,
        accessToken: parsed.accessToken,
        expiresAt: parsed.expiresAt
      };
    }
    if (!parsed.encryptedAccessToken) {
      throw new Error("Stored session missing access token payload");
    }
    return {
      id: sessionId,
      accessToken: this.decryptToken(parsed.encryptedAccessToken),
      expiresAt: parsed.expiresAt
    };
  }

  public async create(args: { accessToken: string; ttlSeconds: number }): Promise<AuthSession> {
    const id = randomUUID();
    const expiresAt = Date.now() + args.ttlSeconds * 1000;
    const record = this.toStoredSession({ accessToken: args.accessToken, expiresAt });

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

    try {
      return this.fromStoredSession(sessionId, parsed);
    } catch {
      await this.redis.del(this.key(sessionId));
      return null;
    }
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

  public async close(): Promise<void> {
    await this.redis.quit();
  }
}
