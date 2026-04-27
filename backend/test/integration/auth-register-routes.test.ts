import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/app.js";
import type { TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "../helpers/test-document-service.js";
import { createTestSettingsService } from "../helpers/test-settings-service.js";

type AuthAdminClientMock = {
  createUser: (args: { email: string; password: string }) => Promise<void>;
};

const tokenVerifier: TokenVerifier = {
  verify: async () => ({
    actorSub: "test-sub",
    username: "test-user",
    email: "test@example.com",
    scopes: []
  })
};

/** Meets Cognito pool policy (see CDK UserPool) and backend zod schema. */
const VALID_REGISTER_PASSWORD = "ValidPass123!Horse";

describe("POST /auth/register", () => {
  const authAdminClient: AuthAdminClientMock = {
    createUser: vi.fn(async () => {})
  };

  const app = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*"
    } as any,
    {
      tokenVerifier,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService(),
      keycloakAdminClient: authAdminClient
    } as any
  );
  const appWithoutAdmin = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*"
    } as any,
    {
      tokenVerifier,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService(),
      keycloakAdminClient: null
    } as any
  );
  const appWithStrictRegisterLimit = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      AUTH_REGISTER_RATE_LIMIT_WINDOW_MS: 60_000,
      AUTH_REGISTER_RATE_LIMIT_MAX_ATTEMPTS: 1
    } as any,
    {
      tokenVerifier,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService(),
      keycloakAdminClient: authAdminClient
    } as any
  );

  beforeAll(async () => {
    await app.ready();
    await appWithoutAdmin.ready();
    await appWithStrictRegisterLimit.ready();
  });

  afterAll(async () => {
    await app.close();
    await appWithoutAdmin.close();
    await appWithStrictRegisterLimit.close();
  });

  it("GET /auth/register returns 405 (registration is POST-only)", async () => {
    const response = await request(app.server).get("/auth/register");
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("POST");
  });

  it("creates a Keycloak user for valid email/password", async () => {
    const response = await request(app.server).post("/auth/register").send({
      email: "new.user@example.com",
      password: VALID_REGISTER_PASSWORD
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: "Account created." });
    expect(authAdminClient.createUser).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: VALID_REGISTER_PASSWORD
    });
  });

  it("returns 409 when email is already taken", async () => {
    vi.mocked(authAdminClient.createUser).mockRejectedValueOnce({
      code: "KEYCLOAK_USER_EXISTS"
    });

    const response = await request(app.server).post("/auth/register").send({
      email: "taken@example.com",
      password: VALID_REGISTER_PASSWORD
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("AUTH_EMAIL_TAKEN");
  });

  it("returns 409 when cognito reports an existing user", async () => {
    vi.mocked(authAdminClient.createUser).mockRejectedValueOnce({
      code: "COGNITO_USER_EXISTS"
    });

    const response = await request(app.server).post("/auth/register").send({
      email: "taken@example.com",
      password: VALID_REGISTER_PASSWORD
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("AUTH_EMAIL_TAKEN");
  });

  it("returns 400 for invalid email", async () => {
    const response = await request(app.server).post("/auth/register").send({
      email: "not-an-email",
      password: VALID_REGISTER_PASSWORD
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 500 when auth admin configuration is incomplete", async () => {
    const response = await request(appWithoutAdmin.server).post("/auth/register").send({
      email: "new.user@example.com",
      password: VALID_REGISTER_PASSWORD
    });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("CONFIG_AUTH_ADMIN_INCOMPLETE");
  });

  it("returns 502 when keycloak is unavailable", async () => {
    vi.mocked(authAdminClient.createUser).mockRejectedValueOnce(new Error("upstream down"));

    const response = await request(app.server).post("/auth/register").send({
      email: "new.user@example.com",
      password: VALID_REGISTER_PASSWORD
    });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe("AUTH_IDP_UNAVAILABLE");
  });

  it("returns 429 after exceeding per-IP sign-up rate limit", async () => {
    const first = await request(appWithStrictRegisterLimit.server).post("/auth/register").send({
      email: "rate.limit.a@example.com",
      password: VALID_REGISTER_PASSWORD
    });
    expect(first.status).toBe(201);

    const second = await request(appWithStrictRegisterLimit.server).post("/auth/register").send({
      email: "rate.limit.b@example.com",
      password: VALID_REGISTER_PASSWORD
    });
    expect(second.status).toBe(429);
    expect(second.body.code).toBe("AUTH_RATE_LIMITED");
  });
});

