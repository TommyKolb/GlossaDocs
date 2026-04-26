import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { ApiError } from "../../src/shared/api-error.js";
import type { TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "../helpers/test-document-service.js";
import { createTestSettingsService } from "../helpers/test-settings-service.js";

const tokenToActor: Record<string, string> = {
  "token-user-1": "user-1",
  "token-user-2": "user-2"
};

const tokenVerifier: TokenVerifier = {
  verify: async (token) => {
    const actorSub = tokenToActor[token];
    if (!actorSub) {
      throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token validation failed");
    }

    return {
      actorSub,
      username: actorSub,
      email: `${actorSub}@example.com`,
      scopes: ["settings:read", "settings:write"]
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
    tokenVerifier,
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

describe("settings routes", () => {
  it("allows CORS preflight for PUT settings updates", async () => {
    const response = await request(app.server)
      .options("/settings")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "PUT")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
  });

  it("returns 401 when reading settings without a token", async () => {
    const response = await request(app.server).get("/settings");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_MISSING_TOKEN");
  });

  it("returns defaults for first-time user settings", async () => {
    const response = await request(app.server)
      .get("/settings")
      .set("Authorization", "Bearer token-user-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      lastUsedLocale: "en-US",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
  });

  it("updates settings and returns persisted values", async () => {
    const updateResponse = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-1")
      .send({ lastUsedLocale: "ru-RU", keyboardVisible: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual({
      lastUsedLocale: "ru-RU",
      keyboardVisible: false,
      keyboardLayoutOverrides: {}
    });

    const readResponse = await request(app.server)
      .get("/settings")
      .set("Authorization", "Bearer token-user-1");

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toEqual({
      lastUsedLocale: "ru-RU",
      keyboardVisible: false,
      keyboardLayoutOverrides: {}
    });
  });

  it("keeps settings isolated per user", async () => {
    await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-1")
      .send({ lastUsedLocale: "de-DE" });

    const otherUserResponse = await request(app.server)
      .get("/settings")
      .set("Authorization", "Bearer token-user-2");

    expect(otherUserResponse.status).toBe(200);
    expect(otherUserResponse.body).toEqual({
      lastUsedLocale: "en-US",
      keyboardVisible: true,
      keyboardLayoutOverrides: {}
    });
  });

  it("returns 400 for empty update payload", async () => {
    const response = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-1")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("persists keyboardLayoutOverrides and returns them on GET", async () => {
    const overrides = { ru: { й: "k", к: "j" } };
    const putResponse = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-1")
      .send({ keyboardLayoutOverrides: overrides });

    expect(putResponse.status).toBe(200);
    expect(putResponse.body.keyboardLayoutOverrides).toEqual(overrides);

    const getResponse = await request(app.server)
      .get("/settings")
      .set("Authorization", "Bearer token-user-1");

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.keyboardLayoutOverrides).toEqual(overrides);
  });

  it("persists keyboardLayoutOverrides for a Latin language and returns them on GET", async () => {
    const overrides = { es: { ñ: "n" } };
    const putResponse = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-1")
      .send({ keyboardLayoutOverrides: overrides });

    expect(putResponse.status).toBe(200);
    expect(putResponse.body.keyboardLayoutOverrides).toEqual(overrides);

    const getResponse = await request(app.server)
      .get("/settings")
      .set("Authorization", "Bearer token-user-1");

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.keyboardLayoutOverrides).toEqual(overrides);
  });

  it("rejects keyboardLayoutOverrides with an unknown top-level language key", async () => {
    const response = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-1")
      .send({ keyboardLayoutOverrides: { xx: {} } });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("updates lastUsedLocale without wiping keyboardLayoutOverrides", async () => {
    const overrides = { en: { q: "x", x: "q" } };
    await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-2")
      .send({ keyboardLayoutOverrides: overrides });

    const patchLocale = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-2")
      .send({ lastUsedLocale: "de-DE" });

    expect(patchLocale.status).toBe(200);
    expect(patchLocale.body.lastUsedLocale).toBe("de-DE");
    expect(patchLocale.body.keyboardLayoutOverrides).toEqual(overrides);
  });

  it("allows clearing keyboardLayoutOverrides explicitly with an empty object", async () => {
    await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-2")
      .send({ keyboardLayoutOverrides: { en: { q: "x" } } });

    const clearResponse = await request(app.server)
      .put("/settings")
      .set("Authorization", "Bearer token-user-2")
      .send({ keyboardLayoutOverrides: {} });

    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.keyboardLayoutOverrides).toEqual({});
  });
});
