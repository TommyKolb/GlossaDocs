import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { ApiError } from "../../src/shared/api-error.js";
import type { TokenVerifier } from "../../src/modules/identity-access/token-verifier.js";
import { createTestDocumentService } from "../helpers/test-document-service.js";
import { createTestSettingsService } from "../helpers/test-settings-service.js";
import { TestAuditWriter } from "../helpers/test-audit-writer.js";

const tokenVerifier: TokenVerifier = {
  verify: async (token) => {
    if (token !== "token-user-1") {
      throw new ApiError(401, "AUTH_INVALID_TOKEN", "Token validation failed");
    }
    return {
      actorSub: "user-1",
      username: "user-1",
      email: "user-1@example.com",
      scopes: []
    };
  }
};

const auditWriter = new TestAuditWriter();

const app = buildApp(
  {
    NODE_ENV: "test",
    API_PORT: 4000,
    CORS_ALLOWED_ORIGINS: "*"
  },
  {
    tokenVerifier,
    documentService: createTestDocumentService(),
    settingsService: createTestSettingsService(),
    auditWriter
  }
);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("audit hook behavior", () => {
  it("writes audit event for mutating requests", async () => {
    const response = await request(app.server)
      .post("/documents")
      .set("Authorization", "Bearer token-user-1")
      .send({ title: "Audited", content: "<p>x</p>", language: "en" });

    expect(response.status).toBe(201);

    const events = auditWriter.events();
    const latest = events[events.length - 1];
    expect(latest?.method).toBe("POST");
    expect(latest?.route).toBe("/documents");
    expect(latest?.actorSub).toBe("user-1");
    expect(latest?.statusCode).toBe(201);
    expect(latest?.payloadHash).not.toBeNull();
  });

  it("does not write audit event for read-only requests", async () => {
    const beforeCount = auditWriter.events().length;
    const response = await request(app.server)
      .get("/documents")
      .set("Authorization", "Bearer token-user-1");

    expect(response.status).toBe(200);
    const afterCount = auditWriter.events().length;
    expect(afterCount).toBe(beforeCount);
  });
});
