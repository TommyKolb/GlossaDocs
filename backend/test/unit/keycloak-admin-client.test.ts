import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HttpKeycloakAdminClient,
  isKeycloakAdminErrorCode,
  KeycloakAdminClientError,
  requireKeycloakAdminConfig
} from "../../src/modules/identity-access/keycloak-admin-client.js";
import { ApiError } from "../../src/shared/api-error.js";

const adminConfig = {
  adminUrl: "http://keycloak:8080",
  realm: "glossadocs",
  adminUsername: "admin",
  adminPassword: "admin"
};

function jsonResponse(
  body: unknown,
  init: { ok: boolean; status?: number; headers?: Headers }
): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 400),
    json: async () => body,
    headers: init.headers ?? new Headers()
  } as Response;
}

describe("isKeycloakAdminErrorCode", () => {
  it("returns true when a KeycloakAdminClientError matches the expected code", () => {
    const err = new KeycloakAdminClientError("KEYCLOAK_USER_EXISTS", "exists");
    expect(isKeycloakAdminErrorCode(err, "KEYCLOAK_USER_EXISTS")).toBe(true);
    expect(isKeycloakAdminErrorCode(err, "KEYCLOAK_USER_NOT_FOUND")).toBe(false);
  });

  it("returns true for a plain object with a matching code field", () => {
    expect(isKeycloakAdminErrorCode({ code: "KEYCLOAK_USER_NOT_FOUND" }, "KEYCLOAK_USER_NOT_FOUND")).toBe(
      true
    );
  });

  it("returns false for primitives", () => {
    expect(isKeycloakAdminErrorCode("oops", "KEYCLOAK_USER_EXISTS")).toBe(false);
  });
});

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
      adminPassword: "p",
      executeActionsClientId: undefined,
      executeActionsRedirectUri: undefined
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

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when a subsequent admin request rejects before a response", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockRejectedValueOnce(new Error("econnreset"));

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
      .mockResolvedValueOnce(jsonResponse([], { ok: true }))
      .mockResolvedValueOnce(jsonResponse([], { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "nobody@example.com" })).rejects.toMatchObject({
      code: "KEYCLOAK_USER_NOT_FOUND"
    });
  });

  it("completes createUser when token, user create, and password set all succeed", async () => {
    const headers = new Headers();
    headers.set(
      "location",
      "http://keycloak:8080/admin/realms/glossadocs/users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true, status: 201, headers }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(
      client.createUser({ email: "new.user@example.com", password: "secret12" })
    ).resolves.toBeUndefined();
  });

  it("uses GlossaDocs as firstName when the email has no local part before @", async () => {
    const headers = new Headers();
    headers.set("location", "http://keycloak:8080/admin/realms/glossadocs/users/u1");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as { firstName?: string };
        expect(body.firstName).toBe("GlossaDocs");
        return jsonResponse({}, { ok: true, status: 201, headers });
      })
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await client.createUser({ email: "@example.com", password: "pw" });
  });

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when user create returns non-409 failure", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "a@b.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when create response has no Location user id", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true, status: 201 }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "a@b.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("throws KEYCLOAK_ADMIN_UNAVAILABLE when password reset fails after user create", async () => {
    const headers = new Headers();
    headers.set("location", "http://keycloak:8080/admin/realms/glossadocs/users/user-id-1");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true, status: 201, headers }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.createUser({ email: "a@b.com", password: "pw" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("completes sendPasswordResetEmail when lookup and execute-actions succeed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "user-uuid" }], { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "exists@example.com" })).resolves.toBeUndefined();
  });

  it("falls back to username lookup when email search returns no users", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse([], { ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "user-uuid" }], { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "exists@example.com" })).resolves.toBeUndefined();
  });

  it("fails closed when user lookup returns multiple matches", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "a" }, { id: "b" }], { ok: true }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "exists@example.com" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("adds client_id and redirect_uri to execute-actions when configured", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "user-uuid" }], { ok: true }))
      .mockImplementationOnce(async (url) => {
        expect(String(url)).toContain("execute-actions-email");
        expect(String(url)).toContain("client_id=glossadocs-api");
        expect(String(url)).toContain(encodeURIComponent("http://localhost:5173/"));
        return jsonResponse({}, { ok: true });
      });

    const client = new HttpKeycloakAdminClient({
      ...adminConfig,
      executeActionsClientId: "glossadocs-api",
      executeActionsRedirectUri: "http://localhost:5173/"
    });
    await client.sendPasswordResetEmail({ email: "exists@example.com" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when user lookup HTTP response is not ok", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "x@example.com" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });

  it("throws when execute-actions-email response is not ok", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ access_token: "admin-token" }, { ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "user-uuid" }], { ok: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    const client = new HttpKeycloakAdminClient(adminConfig);
    await expect(client.sendPasswordResetEmail({ email: "x@example.com" })).rejects.toMatchObject({
      code: "KEYCLOAK_ADMIN_UNAVAILABLE"
    });
  });
});
