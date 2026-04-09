import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { InMemoryAuthSessionStore } from "../../src/modules/identity-access/auth-session-store.js";
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

const app = buildApp({
  NODE_ENV: "test",
  API_PORT: 4000,
  CORS_ALLOWED_ORIGINS: "*"
}, {
  tokenVerifier: testTokenVerifier,
  documentService: createTestDocumentService(),
  settingsService: createTestSettingsService()
});

const failingSessionStore = new InMemoryAuthSessionStore();
failingSessionStore.healthCheck = async () => {
  throw new Error("redis down");
};

const appWithFailingSessionStore = buildApp(
  {
    NODE_ENV: "test",
    API_PORT: 4000,
    CORS_ALLOWED_ORIGINS: "*"
  },
  {
    tokenVerifier: testTokenVerifier,
    documentService: createTestDocumentService(),
    settingsService: createTestSettingsService(),
    authSessionStore: failingSessionStore
  }
);

beforeAll(async () => {
  await app.ready();
  await appWithFailingSessionStore.ready();
});

afterAll(async () => {
  await app.close();
  await appWithFailingSessionStore.close();
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
    expect(response.body.status).toBe("ready");
    expect(Array.isArray(response.body.checks)).toBe(true);
    expect(response.body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: "postgres", ok: true }),
        expect.objectContaining({ dependency: "auth_session_store", ok: true })
      ])
    );
  });

  it("GET /ready returns 503 when a dependency health check fails", async () => {
    const response = await request(appWithFailingSessionStore.server).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("not_ready");
    expect(response.body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependency: "auth_session_store",
          ok: false
        })
      ])
    );
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(app.server).get("/does-not-exist");
    expect(response.status).toBe(404);
  });
});
