import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeOidcLogin, loginWithCredentials, logout } from "./auth";

vi.mock("../api/endpoints", () => ({
  meApi: {
    get: vi.fn()
  }
}));

const originalLocation = window.location;

describe("OIDC login utilities", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        href: "http://localhost:5173/",
        origin: "http://localhost:5173",
        assign: vi.fn()
      },
      writable: true
    });

    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          arr.fill(7);
          return arr;
        },
        subtle: {
          digest: vi.fn(async () => new Uint8Array(32).fill(9).buffer)
        }
      },
      writable: true
    });

    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("loginWithCredentials redirects to the OIDC authorize endpoint with PKCE params", async () => {
    await expect(
      loginWithCredentials({ username: "user@example.com", password: "irrelevant" })
    ).rejects.toThrow();

    const assigned = vi.mocked((window.location as any).assign).mock.calls.at(-1)?.[0] as string;
    expect(assigned).toContain("protocol/openid-connect/auth");
    expect(assigned).toContain("response_type=code");
    expect(assigned).toContain("client_id=");
    expect(assigned).toContain("code_challenge_method=S256");
    expect(assigned).toContain("code_challenge=");
    expect(assigned).toContain("login_hint=user%40example.com");
    expect(assigned).toContain("prompt=login");
    expect(sessionStorage.getItem("glossadocs_pkce_code_verifier")).toBeTruthy();
  });

  it("completeOidcLogin exchanges code for token and bootstraps user", async () => {
    sessionStorage.setItem("glossadocs_pkce_code_verifier", "verifier");

    const fakeToken = "access.token.value";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ access_token: fakeToken })
        } as any)
      )
    );

    const { meApi } = await import("../api/endpoints");
    vi.mocked(meApi.get).mockResolvedValue({
      sub: "user-123",
      username: "alice",
      email: "alice@example.com",
      scopes: []
    });

    const user = await completeOidcLogin("auth-code");
    expect(user).toEqual({
      id: "user-123",
      username: "alice",
      email: "alice@example.com",
      isGuest: false
    });
    expect(localStorage.getItem("authToken")).toBe(fakeToken);
  });

  it("logout clears local auth state and redirects to Keycloak end-session", async () => {
    localStorage.setItem("authToken", "existing-token");
    localStorage.setItem("glossadocs_user", JSON.stringify({ id: "u1" }));

    await logout();

    expect(localStorage.getItem("authToken")).toBeNull();
    expect(localStorage.getItem("glossadocs_user")).toBeNull();

    const assigned = vi.mocked((window.location as any).assign).mock.calls.at(-1)?.[0] as string;
    expect(assigned).toContain("/protocol/openid-connect/logout");
    expect(assigned).toContain("client_id=");

    const expectedRedirect = `${window.location.origin}/`;
    const encodedRedirect = encodeURIComponent(expectedRedirect);
    expect(assigned).toContain(`post_logout_redirect_uri=${encodedRedirect}`);
  });
});

