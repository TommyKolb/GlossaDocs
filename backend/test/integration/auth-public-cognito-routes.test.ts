import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import type { TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "../helpers/test-document-service.js";
import { createTestSettingsService } from "../helpers/test-settings-service.js";

const testTokenVerifier: TokenVerifier = {
  verify: async () => ({
    actorSub: "test-sub",
    username: "test-user",
    email: "test@example.com",
    scopes: []
  })
};

describe("public auth bootstrap routes (cognito mode)", () => {
  const app = buildApp(
    {
      NODE_ENV: "test",
      API_PORT: 4000,
      CORS_ALLOWED_ORIGINS: "*",
      AUTH_PROVIDER: "cognito",
      OIDC_PUBLIC_ISSUER_URL: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool",
      OIDC_PUBLIC_CLIENT_ID: "frontend-client",
      OIDC_PUBLIC_REDIRECT_URI: "https://app.example.com/auth/callback",
      COGNITO_PUBLIC_DOMAIN: "https://example.auth.us-east-1.amazoncognito.com"
    } as any,
    {
      tokenVerifier: testTokenVerifier,
      documentService: createTestDocumentService(),
      settingsService: createTestSettingsService()
    }
  );

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns Cognito hosted-ui login and signup URLs", async () => {
    const response = await request(app.server).get("/auth/public");
    expect(response.status).toBe(200);
    expect(response.body.authProvider).toBe("cognito");
    expect(response.body.loginUrl).toContain("/login?");
    expect(response.body.registrationUrl).toContain("/signup?");
  });
});
