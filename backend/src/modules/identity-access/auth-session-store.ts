import { randomUUID } from "node:crypto";

export interface AuthSession {
  id: string;
  accessToken: string;
  expiresAt: number;
}

export interface AuthSessionStore {
  create(args: { accessToken: string; ttlSeconds: number }): AuthSession;
  get(sessionId: string): AuthSession | null;
  delete(sessionId: string): void;
}

export class InMemoryAuthSessionStore implements AuthSessionStore {
  private readonly sessions = new Map<string, AuthSession>();

  public create(args: { accessToken: string; ttlSeconds: number }): AuthSession {
    const session: AuthSession = {
      id: randomUUID(),
      accessToken: args.accessToken,
      expiresAt: Date.now() + args.ttlSeconds * 1000
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public get(sessionId: string): AuthSession | null {
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

  public delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
