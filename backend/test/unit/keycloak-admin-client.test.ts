import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HttpKeycloakAdminClient,
  requireKeycloakAdminConfig
} from "../../src/modules/identity-access/keycloak-admin-client.js";
import { ApiError } from "../../src/shared/api-error.js";

const adminConfig = {
  adminUrl: "http://keycloak:8080",
  realm: "glossadocs",
  adminUsername: "admin",
  adminPassword: "admin"
};

function jsonResponse(body: unknown, init: { ok: boolean; status?: number }): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 400),
    json: async () => body,
    headers: new Headers()
  } as Response;
}

describe("requireKeycloakAdminConfig", () => {
  it("throws ApiError when any admin field is missing", () => {
    expect(() =>
      requireKeycloakAdminConfig({
        adminUrl: "http://k",
        realm: "r",
        adminUsername: "u"
        // adminPassword missing
      })
    ).toThrow(ApiError);
  });

  it("returns complete config when all fields are set", () => {
    const cfg = requireKeycloakAdminConfig({
      adminUrl: "http://k",
      realm: "r",
      adminUsername: "u",
      adminPassword: "p"
    });
    expect(cfg).toEqual({
      adminUrl: "http://k",
      realm: "r",
      adminUsername: "u",
      adminPassword: "p"
    });
  });
});

describe("HttpKeycloakAdminClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when token HTTP response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "a@b.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when token JSON has no access_token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "a@b.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when token fetch rejects", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("econnrefused"));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "a@b.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("maps create user 409 to KEYCLOAK_USER_EXISTS", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(
          {},
          { ok: false, status: 409 }
        )
      );

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "exists@example.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_USER_EXISTS"
    });
  });

  it("maps empty user search to KEYCLOAK_USER_NOT_FOUND for password reset", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse([], { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "nobody@example.com" })).rejects.toMatchObject({
      code: "KEYCLOAK_USER_NOT_FOUND"
    });
  });
});
