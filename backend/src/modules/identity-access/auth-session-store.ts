import { randomUUID } from "node:crypto";

export interface AuthSession {
  id: string;
  accessToken: string;
  expiresAt: number;
}

export interface AuthSessionStore {
  create(args: { accessToken: string; ttlSeconds: number }): Promise<AuthSession>;
  get(sessionId: string): Promise<AuthSession | null>;
  delete(sessionId: string): Promise<void>;
}

export class InMemoryAuthSessionStore implements AuthSessionStore {
  private readonly sessions = new Map<string, AuthSession>();

  public async create(args: { accessToken: string; ttlSeconds: number }): Promise<AuthSession> {
    const session: AuthSession = {
      id: randomUUID(),
      accessToken: args.accessToken,
      expiresAt: Date.now() + args.ttlSeconds * 1000
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public async get(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  public async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
