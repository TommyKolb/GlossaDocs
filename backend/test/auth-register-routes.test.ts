import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import type { TokenVerifier } from "../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "./helpers/test-document-service.js";
import { createTestSettingsService } from "./helpers/test-settings-service.js";

type KeycloakAdminClient = {
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

describe("POST /auth/register", () => {
  const keycloakAdminClient: KeycloakAdminClient = {
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
      keycloakAdminClient
    } as any
  );

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a Keycloak user for valid email/password", async () => {
    const response = await request(app.server).post("/auth/register").send({
      email: "new.user@example.com",
      password: "correct horse battery staple"
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: "Account created." });
    expect(keycloakAdminClient.createUser).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: "correct horse battery staple"
    });
  });

  it("returns 409 when email is already taken", async () => {
    vi.mocked(keycloakAdminClient.createUser).mockRejectedValueOnce({
      code: "KEYCLOAK_USER_EXISTS"
    });

    const response = await request(app.server).post("/auth/register").send({
      email: "taken@example.com",
      password: "correct horse battery staple"
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("AUTH_EMAIL_TAKEN");
  });

  it("returns 400 for invalid email", async () => {
    const response = await request(app.server).post("/auth/register").send({
      email: "not-an-email",
      password: "correct horse battery staple"
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

