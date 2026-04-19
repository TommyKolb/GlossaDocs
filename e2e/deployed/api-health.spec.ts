import { expect, test } from "@playwright/test";

import { getProdApiBase } from "./env";

test.describe("D-API-01 / D-API-02 — deployed API probes", () => {
  test("D-API-01: GET /health returns ok", async ({ request }) => {
    const base = getProdApiBase();
    test.skip(!base, "Set PROD_API_BASE_URL to run API health checks");
    const response = await request.get(`${base}/health`);
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  test("D-API-02: GET /ready reports ready", async ({ request }) => {
    const base = getProdApiBase();
    test.skip(!base, "Set PROD_API_BASE_URL to run API readiness checks");
    const response = await request.get(`${base}/ready`);
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { status?: string; checks?: Array<{ ok: boolean }> };
    expect(body.status).toBe("ready");
    expect(body.checks?.every((c) => c.ok)).toBeTruthy();
  });
});
