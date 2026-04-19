import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/app.js";
import type { TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "../helpers/test-document-service.js";
import { createTestSettingsService } from "../helpers/test-settings-service.js";

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

  it("returns 501 for password-reset confirm when auth provider is Keycloak", async () => {
    const response = await request(app.server).post("/auth/password-reset/confirm").send({
      email: "user@example.com",
      code: "123456",
      newPassword: "ValidPass123!Aa"
    });

    expect(response.status).toBe(501);
    expect(response.body.code).toBe("AUTH_PASSWORD_RESET_CONFIRM_UNSUPPORTED");
  });
});

describe("POST /auth/password-reset/confirm (Cognito)", () => {
  const cognitoAdminClient = {
    sendPasswordResetEmail: vi.fn(async () => {}),
    confirmForgotPassword: vi.fn(async () => {})
  };

  const app = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      AUTH_PROVIDER: "cognito"
    } as any,
    {
      tokenVerifier,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService(),
      authAdminClient: cognitoAdminClient
    } as any
  );

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const validPassword = "ValidPass123!Aa";

  it("completes reset when Cognito accepts the confirmation", async () => {
    const response = await request(app.server).post("/auth/password-reset/confirm").send({
      email: "user@example.com",
      code: "123456",
      newPassword: validPassword
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/password has been reset/i);
    expect(cognitoAdminClient.confirmForgotPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      code: "123456",
      newPassword: validPassword
    });
  });

  it("returns 400 when verification code is invalid", async () => {
    const { CognitoAdminClientError } = await import(
      "../../src/modules/identity-access/cognito-admin-client.js"
    );
    vi.mocked(cognitoAdminClient.confirmForgotPassword).mockRejectedValueOnce(
      new CognitoAdminClientError("COGNITO_RESET_CODE_INVALID", "Invalid verification code.")
    );

    const response = await request(app.server).post("/auth/password-reset/confirm").send({
      email: "user@example.com",
      code: "wrong",
      newPassword: validPassword
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("COGNITO_RESET_CODE_INVALID");
  });
});

