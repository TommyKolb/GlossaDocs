import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { TokenVerifier } from "../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "./helpers/test-document-service.js";
import { createTestSettingsService } from "./helpers/test-settings-service.js";

const testTokenVerifier: TokenVerifier = {
  verify: async () => ({
    actorSub: "test-sub",
    username: "test-user",
    email: "test@example.com",
    scopes: []
  })
};

function buildTestApp() {
  // NOTE: This test describes a NEW endpoint and NEW config fields.
  // The config object is cast to avoid blocking TDD on config typing changes.
  return buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      OIDC_PUBLIC_ISSUER_URL: "http://localhost:8080/realms/glossadocs",
      OIDC_PUBLIC_CLIENT_ID: "glossadocs-frontend",
      OIDC_PUBLIC_REDIRECT_URI: "http://localhost:5173/auth/callback"
    } as any,
    {
      tokenVerifier: testTokenVerifier,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService()
    }
  );
}

describe("public auth bootstrap routes", () => {
  const app = buildTestApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /auth/public returns public OIDC values and derived auth URLs (no auth required)", async () => {
    const response = await request(app.server).get("/auth/public");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      issuerUrl: "http://localhost:8080/realms/glossadocs",
      clientId: "glossadocs-frontend",
      redirectUri: "http://localhost:5173/auth/callback",
      loginUrl:
        "http://localhost:8080/realms/glossadocs/protocol/openid-connect/auth?client_id=glossadocs-frontend&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&response_type=code&scope=openid",
      registrationUrl:
        "http://localhost:8080/realms/glossadocs/protocol/openid-connect/auth?client_id=glossadocs-frontend&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&response_type=code&scope=openid&kc_action=register"
    });
  });

  it("constructs loginUrl with stable Keycloak authorize endpoint and required query params", async () => {
    const response = await request(app.server).get("/auth/public");
    expect(response.status).toBe(200);

    const loginUrl = new URL(response.body.loginUrl as string);
    expect(loginUrl.origin).toBe("http://localhost:8080");
    expect(loginUrl.pathname).toBe("/realms/glossadocs/protocol/openid-connect/auth");

    const params = loginUrl.searchParams;
    expect(params.get("client_id")).toBe("glossadocs-frontend");
    expect(params.get("redirect_uri")).toBe("http://localhost:5173/auth/callback");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe("openid");
    expect(params.get("kc_action")).toBe(null);
  });

  it("constructs registrationUrl by adding kc_action=register", async () => {
    const response = await request(app.server).get("/auth/public");
    expect(response.status).toBe(200);

    const registrationUrl = new URL(response.body.registrationUrl as string);
    expect(registrationUrl.pathname).toBe("/realms/glossadocs/protocol/openid-connect/auth");
    expect(registrationUrl.searchParams.get("kc_action")).toBe("register");
  });

  it("does not leak secrets in the response payload", async () => {
    const response = await request(app.server).get("/auth/public");
    expect(response.status).toBe(200);

    const payloadKeys = Object.keys(response.body ?? {});
    expect(payloadKeys).not.toContain("DATABASE_URL");
    expect(payloadKeys).not.toContain("databaseUrl");
    expect(payloadKeys).not.toContain("DOCUMENT_ENCRYPTION_KEY");
    expect(payloadKeys).not.toContain("documentEncryptionKey");
  });
});

