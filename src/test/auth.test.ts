import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  continueAsGuest,
  getCurrentUser,
  getAuthenticatedUserFromBackend,
  loginWithCredentials,
  logout
} from "@/app/utils/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loginWithCredentials stores app user after backend login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            user: {
              sub: "user-123",
              username: "alice",
              email: "alice@example.com"
            }
          })
        } as any)
      )
    );

    const user = await loginWithCredentials({
      username: "alice@example.com",
      password: "secret"
    });
    expect(user).toEqual({
      id: "user-123",
      username: "alice",
      email: "alice@example.com",
      isGuest: false
    });
    expect(localStorage.getItem("glossadocs_user")).toContain("alice");
  });

  it("logout clears local auth state and calls backend logout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          status: 204,
          json: async () => ({})
        } as any)
      )
    );
    localStorage.setItem("glossadocs_user", JSON.stringify({ id: "u1" }));

    await logout();

    expect(localStorage.getItem("glossadocs_user")).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({
        method: "POST",
        credentials: "include"
      })
    );
  });

  it("getAuthenticatedUserFromBackend clears local auth when session is missing", async () => {
    localStorage.setItem(
      "glossadocs_user",
      JSON.stringify({
        id: "user-123",
        username: "alice",
        email: "alice@example.com",
        isGuest: false
      })
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ code: "AUTH_MISSING_SESSION" })
        } as any)
      )
    );

    const user = await getAuthenticatedUserFromBackend();
    expect(user).toBeNull();
    expect(localStorage.getItem("glossadocs_user")).toBeNull();
  });

  it("getCurrentUser clears malformed stored user data", () => {
    localStorage.setItem("glossadocs_user", JSON.stringify({ id: "user-1", isGuest: false }));
    const user = getCurrentUser();
    expect(user).toBeNull();
    expect(localStorage.getItem("glossadocs_user")).toBeNull();
  });

  it("continueAsGuest stores and returns guest profile", async () => {
    const user = await continueAsGuest();
    expect(user.isGuest).toBe(true);
    expect(user.username).toBe("Guest");
    expect(localStorage.getItem("glossadocs_user")).toContain('"isGuest":true');
  });
});
