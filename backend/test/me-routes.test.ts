import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { ApiError } from "../src/shared/api-error.js";
import type { TokenVerifier } from "../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "./helpers/test-document-service.js";
import { createTestSettingsService } from "./helpers/test-settings-service.js";

const validToken = "good-token";
const expiredToken = "expired-token";
const badSignatureToken = "bad-signature-token";
const wrongIssuerToken = "wrong-issuer-token";
const wrongAudienceToken = "wrong-audience-token";

const testTokenVerifier: TokenVerifier = {
  verify: async (token) => {
    if (token === expiredToken) {
      throw new ApiError(401, "AUTH_TOKEN_EXPIRED", "Token is expired");
    }
    if (token === badSignatureToken) {
      throw new ApiError(401, "AUTH_INVALID_SIGNATURE", "Token signature is invalid");
    }
    if (token === wrongIssuerToken) {
      throw new ApiError(401, "AUTH_INVALID_ISSUER", "Token issuer is invalid");
    }
    if (token === wrongAudienceToken) {
      throw new ApiError(401, "AUTH_INVALID_AUDIENCE", "Token audience is invalid");
    }

    if (token !== validToken) {
      throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token validation failed");
    }

    return {
      actorSub: "user-123",
      username: "alice",
      email: "alice@example.com",
      scopes: ["documents:read", "documents:write"]
    };
  }
};

const app = buildApp(
  {
    NODE_ENV: "test",
    API_PORT: 4000,
    CORS_ALLOWED_ORIGINS: "*"
  },
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

describe("/me auth behavior", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const response = await request(app.server).get("/me");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_MISSING_TOKEN");
  });

  it("returns 401 when Authorization header is malformed", async () => {
    const response = await request(app.server).get("/me").set("Authorization", "Token abc");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_BAD_AUTHORIZATION");
  });

  it("returns 401 when token fails validation", async () => {
    const response = await request(app.server)
      .get("/me")
      .set("Authorization", "Bearer bad-token");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("returns 401 when token signature is invalid", async () => {
    const response = await request(app.server)
      .get("/me")
      .set("Authorization", `Bearer ${badSignatureToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_SIGNATURE");
  });

  it("returns 401 when token issuer is invalid", async () => {
    const response = await request(app.server)
      .get("/me")
      .set("Authorization", `Bearer ${wrongIssuerToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_ISSUER");
  });

  it("returns 401 when token audience is invalid", async () => {
    const response = await request(app.server)
      .get("/me")
      .set("Authorization", `Bearer ${wrongAudienceToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_INVALID_AUDIENCE");
  });

  it("returns 401 when token is expired", async () => {
    const response = await request(app.server)
      .get("/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("returns user claims when token is valid", async () => {
    const response = await request(app.server)
      .get("/me")
      .set("Authorization", `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sub: "user-123",
      username: "alice",
      email: "alice@example.com",
      scopes: ["documents:read", "documents:write"]
    });
  });
});
