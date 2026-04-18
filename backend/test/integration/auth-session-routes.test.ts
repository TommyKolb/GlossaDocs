import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/app.js";
import {
  InMemoryAuthSessionStore,
  type AuthSessionStore
} from "../../src/modules/identity-access/auth-session-store.js";
import { KeycloakOidcClientError } from "../../src/modules/identity-access/keycloak-oidc-client.js";
import type { AuthPasswordLoginClient } from "../../src/modules/identity-access/auth-provider-clients.js";
import type { TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";
import { ApiError } from "../../src/shared/api-error.js";
import { createTestDocumentService } from "../helpers/test-document-service.js";
import { createTestSettingsService } from "../helpers/test-settings-service.js";

const tokenVerifier: TokenVerifier = {
  verify: async (token) => {
    if (token === "good-token") {
      return {
        actorSub: "user-123",
        username: "alice",
        email: "alice@example.com",
        scopes: []
      };
    }
    throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token validation failed");
  }
};

describe("auth session routes", () => {
  const passwordLoginClient: AuthPasswordLoginClient = {
    loginWithPassword: vi.fn(async () => ({
      accessToken: "good-token",
      expiresInSeconds: 3600
    }))
  };

  const app = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      KEYCLOAK_TOKEN_URL: "http://localhost:8080/realms/glossadocs/protocol/openid-connect/token",
      KEYCLOAK_CLIENT_ID: "glossadocs-api",
      AUTH_SESSION_COOKIE_NAME: "glossadocs_session",
      AUTH_SESSION_TTL_SECONDS: 3600,
      AUTH_SESSION_SECURE_COOKIE: false
    } as any,
    {
      tokenVerifier,
      keycloakOidcClient: passwordLoginClient,
      authSessionStore: new InMemoryAuthSessionStore(),
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService()
    }
  );
  const appWithoutOidc = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      AUTH_SESSION_COOKIE_NAME: "glossadocs_session",
      AUTH_SESSION_TTL_SECONDS: 3600,
      AUTH_SESSION_SECURE_COOKIE: false
    } as any,
    {
      tokenVerifier,
      keycloakOidcClient: null,
      authSessionStore: new InMemoryAuthSessionStore(),
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService()
    } as any
  );
  const failingDeleteStore: AuthSessionStore = {
    async create(args) {
      return {
        id: "session-fails-delete",
        accessToken: args.accessToken,
        expiresAt: Date.now() + args.ttlSeconds * 1000
      };
    },
    async get() {
      return null;
    },
    async delete() {
      throw new Error("store unavailable");
    }
  };
  const appWithFailingDeleteStore = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      KEYCLOAK_TOKEN_URL: "http://localhost:8080/realms/glossadocs/protocol/openid-connect/token",
      KEYCLOAK_CLIENT_ID: "glossadocs-api",
      AUTH_SESSION_COOKIE_NAME: "glossadocs_session",
      AUTH_SESSION_TTL_SECONDS: 3600,
      AUTH_SESSION_SECURE_COOKIE: false
    } as any,
    {
      tokenVerifier,
      keycloakOidcClient: passwordLoginClient,
      authSessionStore: failingDeleteStore,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService()
    }
  );
  const appWithStrictRateLimit = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      KEYCLOAK_TOKEN_URL: "http://localhost:8080/realms/glossadocs/protocol/openid-connect/token",
      KEYCLOAK_CLIENT_ID: "glossadocs-api",
      AUTH_SESSION_COOKIE_NAME: "glossadocs_session",
      AUTH_SESSION_TTL_SECONDS: 3600,
      AUTH_SESSION_SECURE_COOKIE: false,
      AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
      AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: 1
    } as any,
    {
      tokenVerifier,
      keycloakOidcClient: passwordLoginClient,
      authSessionStore: new InMemoryAuthSessionStore(),
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService()
    } as any
  );

  beforeAll(async () => {
    await app.ready();
    await appWithoutOidc.ready();
    await appWithFailingDeleteStore.ready();
    await appWithStrictRateLimit.ready();
  });

  afterAll(async () => {
    await app.close();
    await appWithoutOidc.close();
    await appWithFailingDeleteStore.close();
    await appWithStrictRateLimit.close();
  });

  it("GET /auth/login returns 405 (login is POST-only; browsers open links as GET)", async () => {
    const response = await request(app.server).get("/auth/login");
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("POST");
  });

  it("POST /auth/login sets session cookie and returns user profile", async () => {
    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        sub: "user-123",
        username: "alice",
        email: "alice@example.com"
      }
    });
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(vi.mocked(passwordLoginClient.loginWithPassword)).toHaveBeenCalledWith({
      username: "alice@example.com",
      password: "secret"
    });
  });

  it("GET /auth/session returns 401 when cookie is missing", async () => {
    const response = await request(app.server).get("/auth/session");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_MISSING_SESSION");
  });

  it("GET /auth/session returns 401 when cookie session is invalid", async () => {
    const response = await request(app.server)
      .get("/auth/session")
      .set("Cookie", "glossadocs_session=missing-session");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_SESSION");
  });

  it("GET /auth/session returns current user when cookie session is valid", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });
    const cookie = loginResponse.headers["set-cookie"]?.[0];
    expect(cookie).toBeTruthy();

    const sessionResponse = await request(app.server).get("/auth/session").set("Cookie", cookie as string);
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toEqual({
      user: {
        sub: "user-123",
        username: "alice",
        email: "alice@example.com"
      }
    });
  });

  it("supports cookie session auth on /me", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });
    const cookie = loginResponse.headers["set-cookie"]?.[0];
    expect(cookie).toBeTruthy();

    const meResponse = await request(app.server).get("/me").set("Cookie", cookie as string);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.sub).toBe("user-123");
  });

  it("POST /auth/logout clears session cookie", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });
    const cookie = loginResponse.headers["set-cookie"]?.[0];
    expect(cookie).toBeTruthy();

    const logoutResponse = await request(app.server)
      .post("/auth/logout")
      .set("Cookie", cookie as string);
    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers["set-cookie"]?.at(0)).toContain("glossadocs_session=;");
  });

  it("POST /auth/logout still clears cookie when store delete fails", async () => {
    const loginResponse = await request(appWithFailingDeleteStore.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });
    const cookie = loginResponse.headers["set-cookie"]?.[0];
    expect(cookie).toBeTruthy();

    const logoutResponse = await request(appWithFailingDeleteStore.server)
      .post("/auth/logout")
      .set("Cookie", cookie as string);
    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers["set-cookie"]?.at(0)).toContain("glossadocs_session=;");
  });

  it.each([
    [
      "keycloak invalid credentials",
      new KeycloakOidcClientError("KEYCLOAK_OIDC_INVALID_CREDENTIALS", "Invalid username or password")
    ],
    ["cognito invalid credentials", { code: "COGNITO_OIDC_INVALID_CREDENTIALS" }]
  ])("POST /auth/login maps %s to 401", async (_scenario, providerError) => {
    vi.mocked(passwordLoginClient.loginWithPassword).mockRejectedValueOnce(providerError);

    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "wrong"
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("POST /auth/login maps unconfirmed Cognito user to 403", async () => {
    vi.mocked(passwordLoginClient.loginWithPassword).mockRejectedValueOnce({
      code: "COGNITO_OIDC_EMAIL_NOT_VERIFIED"
    });

    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("AUTH_EMAIL_NOT_VERIFIED");
  });

  it("POST /auth/login maps unsupported Cognito challenge to 400", async () => {
    vi.mocked(passwordLoginClient.loginWithPassword).mockRejectedValueOnce({
      code: "COGNITO_OIDC_AUTH_CHALLENGE",
      message: "Challenge NEW_PASSWORD_REQUIRED is not supported"
    });

    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("AUTH_CHALLENGE_UNSUPPORTED");
  });

  it("POST /auth/login returns verifier failure when issued token is invalid", async () => {
    vi.mocked(passwordLoginClient.loginWithPassword).mockResolvedValueOnce({
      accessToken: "bad-token",
      expiresInSeconds: 3600
    });

    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("POST /auth/login rate-limits repeated attempts from same IP", async () => {
    const first = await request(appWithStrictRateLimit.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });
    expect(first.status).toBe(200);

    const second = await request(appWithStrictRateLimit.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });
    expect(second.status).toBe(429);
    expect(second.body.code).toBe("AUTH_RATE_LIMITED");
  });

  it("POST /auth/login returns 500 when oidc login is not configured", async () => {
    const response = await request(appWithoutOidc.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "secret"
    });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("CONFIG_AUTH_LOGIN_INCOMPLETE");
  });
});
