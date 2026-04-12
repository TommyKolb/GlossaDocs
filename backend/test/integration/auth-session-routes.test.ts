import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/app.js";
import { InMemoryAuthSessionStore } from "../../src/modules/identity-access/auth-session-store.js";
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

  beforeAll(async () => {
    await app.ready();
    await appWithoutOidc.ready();
  });

  afterAll(async () => {
    await app.close();
    await appWithoutOidc.close();
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

  it("POST /auth/login returns 401 for invalid credentials", async () => {
    vi.mocked(passwordLoginClient.loginWithPassword).mockRejectedValueOnce(
      new KeycloakOidcClientError("KEYCLOAK_OIDC_INVALID_CREDENTIALS", "Invalid username or password")
    );

    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "wrong"
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("POST /auth/login maps cognito invalid credentials to 401", async () => {
    vi.mocked(passwordLoginClient.loginWithPassword).mockRejectedValueOnce({
      code: "COGNITO_OIDC_INVALID_CREDENTIALS"
    });

    const response = await request(app.server).post("/auth/login").send({
      username: "alice@example.com",
      password: "wrong"
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_CREDENTIALS");
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
