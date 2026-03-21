import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import type { TokenVerifier } from "../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "./helpers/test-document-service.js";
import { createTestSettingsService } from "./helpers/test-settings-service.js";

type KeycloakAdminClient = {
  sendPasswordResetEmail: (args: { email: string }) => Promise<void>;
};

const tokenVerifier: TokenVerifier = {
  verify: async () => ({
    actorSub: "test-sub",
    username: "test-user",
    email: "test@example.com",
    scopes: []
  })
};

describe("POST /auth/password-reset", () => {
  const keycloakAdminClient: KeycloakAdminClient = {
    sendPasswordResetEmail: vi.fn(async () => {})
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

  it("returns 200 and triggers email when account exists", async () => {
    const response = await request(app.server).post("/auth/password-reset").send({
      email: "user@example.com"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "If an account exists for that email, a reset message has been sent."
    });
    expect(keycloakAdminClient.sendPasswordResetEmail).toHaveBeenCalledWith({
      email: "user@example.com"
    });
  });

  it("returns 200 even when the account does not exist (no information leak)", async () => {
    vi.mocked(keycloakAdminClient.sendPasswordResetEmail).mockRejectedValueOnce({
      code: "KEYCLOAK_USER_NOT_FOUND"
    });

    const response = await request(app.server).post("/auth/password-reset").send({
      email: "missing@example.com"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "If an account exists for that email, a reset message has been sent."
    });
  });

  it("returns 200 even when keycloak returns a transient error", async () => {
    vi.mocked(keycloakAdminClient.sendPasswordResetEmail).mockRejectedValueOnce(
      new Error("Keycloak timeout")
    );

    const response = await request(app.server).post("/auth/password-reset").send({
      email: "user@example.com"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "If an account exists for that email, a reset message has been sent."
    });
  });

  it("returns 400 for invalid email", async () => {
    const response = await request(app.server).post("/auth/password-reset").send({
      email: "not-an-email"
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});

