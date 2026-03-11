import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { ApiError } from "../src/shared/api-error.js";
import type { TokenVerifier } from "../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "./helpers/test-document-service.js";
import { createTestSettingsService } from "./helpers/test-settings-service.js";

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

describe("document routes", () => {
  it("allows CORS preflight for PUT document updates", async () => {
    const response = await request(app.server)
      .options("/documents/00000000-0000-4000-8000-000000000000")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "PUT")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
  });

  it("returns 401 when listing documents without a token", async () => {
    const response = await request(app.server).get("/documents");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_MISSING_TOKEN");
  });

  it("creates and lists documents for the authenticated owner only", async () => {
    const createResponse = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Doc A", content: "<p>A</p>", language: "en" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.ownerId).toBe("user-1");

    const listUser1 = await request(app.server)
      .get("/documents")
      .set("Authorization", "Bearer token-user-1");
    const listUser2 = await request(app.server)
      .get("/documents")
      .set("Authorization", "Bearer token-user-2");

    expect(listUser1.status).toBe(200);
    expect(listUser1.body).toHaveLength(1);
    expect(listUser2.status).toBe(200);
    expect(listUser2.body).toHaveLength(0);
  });

  it("returns 404 when user tries to access another user's document", async () => {
    const created = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Doc B", content: "<p>B</p>", language: "de" });

    const docId = created.body.id as string;
    const readAsOtherUser = await request(app.server)
      .get(`/documents/${docId}`)
      .set("Authorization", "Bearer token-user-2");

    expect(readAsOtherUser.status).toBe(404);
    expect(readAsOtherUser.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns 400 for invalid create payload language", async () => {
    const response = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Bad Doc", content: "<p>X</p>", language: "fr" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for empty update payload", async () => {
    const created = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Doc C", content: "<p>C</p>", language: "ru" });

    const response = await request(app.server)
      .put(`/documents/${created.body.id as string}`)
      .set("Authorization", "Bearer token-user-1")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns parseable timestamp strings for frontend mapping", async () => {
    const createResponse = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Doc Timestamps", content: "<p>Initial</p>", language: "en" });

    expect(createResponse.status).toBe(201);
    expect(typeof createResponse.body.createdAt).toBe("string");
    expect(typeof createResponse.body.updatedAt).toBe("string");

    const createdAtMs = Date.parse(createResponse.body.createdAt as string);
    const updatedAtMs = Date.parse(createResponse.body.updatedAt as string);
    expect(Number.isNaN(createdAtMs)).toBe(false);
    expect(Number.isNaN(updatedAtMs)).toBe(false);

    const updateResponse = await request(app.server)
      .put(`/documents/${createResponse.body.id as string}`)
      .set("Authorization", "Bearer token-user-1")
      .send({ content: "<p>Updated</p>" });

    expect(updateResponse.status).toBe(200);
    const updatedResponseMs = Date.parse(updateResponse.body.updatedAt as string);
    expect(Number.isNaN(updatedResponseMs)).toBe(false);
    expect(updatedResponseMs).toBeGreaterThanOrEqual(updatedAtMs);
  });

  it("handles concurrent updates without duplicating documents", async () => {
    const createResponse = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Concurrent", content: "<p>Start</p>", language: "en" });

    expect(createResponse.status).toBe(201);
    const docId = createResponse.body.id as string;

    const [update1, update2] = await Promise.all([
      request(app.server)
        .put(`/documents/${docId}`)
        .set("Authorization", "Bearer token-user-1")
        .send({ content: "<p>Update A</p>" }),
      request(app.server)
        .put(`/documents/${docId}`)
        .set("Authorization", "Bearer token-user-1")
        .send({ content: "<p>Update B</p>" })
    ]);

    expect(update1.status).toBe(200);
    expect(update2.status).toBe(200);

    const listResponse = await request(app.server)
      .get("/documents")
      .set("Authorization", "Bearer token-user-1");

    expect(listResponse.status).toBe(200);
    const matchingDocuments = (listResponse.body as Array<{ id: string }>).filter(
      (doc) => doc.id === docId
    );
    expect(matchingDocuments).toHaveLength(1);

    const finalRead = await request(app.server)
      .get(`/documents/${docId}`)
      .set("Authorization", "Bearer token-user-1");
    expect(finalRead.status).toBe(200);
    expect(["<p>Update A</p>", "<p>Update B</p>"]).toContain(finalRead.body.content);
  });
});
