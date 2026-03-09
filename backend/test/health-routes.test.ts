import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const app = buildApp({
  NODE_ENV: "test",
  API_PORT: 4000,
  CORS_ALLOWED_ORIGINS: "*"
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
