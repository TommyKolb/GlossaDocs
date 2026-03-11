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

const app = buildApp({
  NODE_ENV: "test",
  API_PORT: 4000,
  CORS_ALLOWED_ORIGINS: "*"
}, {
  tokenVerifier: testTokenVerifier,
  documentService: createTestDocumentService(),
  settingsService: createTestSettingsService()
});

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("health endpoints", () => {
  it("GET /health returns ok status", async () => {
    const response = await request(app.server).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /ready returns ready status", async () => {
    const response = await request(app.server).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(app.server).get("/does-not-exist");
    expect(response.status).toBe(404);
  });
});
