import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { registerErrorHandler } from "../../src/modules/api-edge/error-handler.js";
import { ApiError } from "../../src/shared/api-error.js";

describe("registerErrorHandler", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false, bodyLimit: 100 });
    registerErrorHandler(app);

    app.get("/api-error", async () => {
      throw new ApiError(403, "FORBIDDEN", "not allowed");
    });

    app.get("/zod", async () => {
      z.object({ a: z.string() }).parse({ a: 1 });
    });

    app.get("/internal", async () => {
      throw new Error("boom");
    });

    app.post("/echo-body", async (request) => request.body);

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("maps ApiError to JSON with status and request id", async () => {
    const res = await request(app.server).get("/api-error");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(res.body.message).toBe("not allowed");
    expect(typeof res.body.requestId).toBe("string");
  });

  it("maps ZodError to validation payload", async () => {
    const res = await request(app.server).get("/zod");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.message).toBe("Request validation failed");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("maps unknown errors to internal error", async () => {
    const res = await request(app.server).get("/internal");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
    expect(res.body.message).toBe("Unexpected server error");
  });

  it("maps request body too large to 413 with PAYLOAD_TOO_LARGE", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/echo-body",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ x: "y".repeat(500) })
    });
    expect(res.statusCode).toBe(413);
    const body = res.json() as { code: string; message: string; requestId: string };
    expect(body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(body.message).toContain("size limit");
    expect(typeof body.requestId).toBe("string");
  });
});
