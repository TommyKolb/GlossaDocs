import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiRequest, getApiBaseUrl } from "@/app/api/client";

/** Minimal fetch `Response` shape used by `apiRequest` (only `ok`, `status`, `json`). */
function jsonResponse(body: unknown, init: { ok: boolean; status: number }): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: async () => body,
  } as Response;
}

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses VITE_API_BASE_URL when set to a non-empty string", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.example:9000");
    expect(getApiBaseUrl()).toBe("http://api.example:9000");
  });

  it("trims whitespace from VITE_API_BASE_URL", () => {
    vi.stubEnv("VITE_API_BASE_URL", "  http://trimmed  ");
    expect(getApiBaseUrl()).toBe("http://trimmed");
  });

  it("falls back to localhost when env is empty", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    expect(getApiBaseUrl()).toBe("http://localhost:4000");
  });
});

describe("apiRequest", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ hello: "world" }, { ok: true, status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns JSON body on success", async () => {
    const data = await apiRequest<{ hello: string }>("/foo");
    expect(data).toEqual({ hello: "world" });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/foo",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.objectContaining({ Accept: "application/json" }),
      })
    );
  });

  it("sends JSON body and Content-Type for POST with body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, { ok: true, status: 200 }));
    await apiRequest("/bar", { method: "POST", body: { a: 1 } });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/bar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ a: 1 }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("returns undefined for 204 responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, { ok: true, status: 204 }));
    const data = await apiRequest("/gone");
    expect(data).toBeUndefined();
  });

  it("throws ApiClientError with server message and code on error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { message: "Missing token", code: "AUTH_MISSING_TOKEN" },
        { ok: false, status: 401 }
      )
    );
    await expect(apiRequest("/documents")).rejects.toMatchObject({
      name: "ApiClientError",
      message: "Missing token",
      status: 401,
      code: "AUTH_MISSING_TOKEN",
    });
    expect(ApiClientError).toBeDefined();
  });

  it("uses default message when error body has no message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));
    await expect(apiRequest("/fail")).rejects.toMatchObject({
      message: "Request failed",
      status: 500,
    });
  });
});
