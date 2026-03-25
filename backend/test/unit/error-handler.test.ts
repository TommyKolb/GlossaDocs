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
    app = Fastify({ logger: false });
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
});
