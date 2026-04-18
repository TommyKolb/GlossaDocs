import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  continueAsGuest,
  getCurrentUser,
  getEffectiveUser,
  getAuthenticatedUserFromBackend,
  loginWithCredentials,
  logout,
  setSessionOverride
} from "@/app/utils/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    setSessionOverride(undefined);
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

  it("getEffectiveUser prefers the React session override over localStorage", () => {
    localStorage.setItem(
      "glossadocs_user",
      JSON.stringify({
        id: "guest_x",
        username: "Guest",
        isGuest: true
      })
    );
    setSessionOverride({
      id: "sub-1",
      username: "alice",
      email: "alice@example.com",
      isGuest: false
    });
    expect(getEffectiveUser()).toEqual({
      id: "sub-1",
      username: "alice",
      email: "alice@example.com",
      isGuest: false
    });
  });

  it("continueAsGuest stores and returns guest profile", async () => {
    const user = await continueAsGuest();
    expect(user.isGuest).toBe(true);
    expect(user.username).toBe("Guest");
    expect(localStorage.getItem("glossadocs_user")).toContain('"isGuest":true');
  });

  describe("getAuthenticatedUserFromBackend", () => {
    it("returns guest from storage without calling the API", async () => {
      localStorage.setItem(
        "glossadocs_user",
        JSON.stringify({
          id: "guest_x",
          username: "Guest",
          isGuest: true
        })
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const user = await getAuthenticatedUserFromBackend();

      expect(user?.isGuest).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("refreshes stored user from /auth/session on success", async () => {
      localStorage.setItem(
        "glossadocs_user",
        JSON.stringify({
          id: "old-id",
          username: "alice",
          email: "old@example.com",
          isGuest: false
        })
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: {
                sub: "new-sub",
                username: "alice",
                email: "new@example.com"
              }
            })
          } as any)
        )
      );

      const user = await getAuthenticatedUserFromBackend();

      expect(user).toEqual({
        id: "new-sub",
        username: "alice",
        email: "new@example.com",
        isGuest: false
      });
      const stored = JSON.parse(localStorage.getItem("glossadocs_user")!);
      expect(stored.id).toBe("new-sub");
      expect(stored.email).toBe("new@example.com");
    });

    it("keeps storage when fetch fails with a non-API error", async () => {
      localStorage.setItem(
        "glossadocs_user",
        JSON.stringify({
          id: "user-123",
          username: "alice",
          email: "alice@example.com",
          isGuest: false
        })
      );
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));

      const user = await getAuthenticatedUserFromBackend();

      expect(user).toEqual({
        id: "user-123",
        username: "alice",
        email: "alice@example.com",
        isGuest: false
      });
      expect(localStorage.getItem("glossadocs_user")).toContain("user-123");
    });

    it("keeps storage when /auth/session fails with 5xx", async () => {
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
            status: 503,
            json: async () => ({ code: "AUTH_IDP_UNAVAILABLE", message: "Unavailable" })
          } as any)
        )
      );

      const user = await getAuthenticatedUserFromBackend();

      expect(user).toEqual({
        id: "user-123",
        username: "alice",
        email: "alice@example.com",
        isGuest: false
      });
      expect(localStorage.getItem("glossadocs_user")).toContain("user-123");
    });

    it("keeps storage when /auth/session aborts (timeout)", async () => {
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
        vi.fn(() => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          return Promise.reject(abortError);
        })
      );

      const user = await getAuthenticatedUserFromBackend();

      expect(user).toEqual({
        id: "user-123",
        username: "alice",
        email: "alice@example.com",
        isGuest: false
      });
      expect(localStorage.getItem("glossadocs_user")).toContain("user-123");
    });
  });
});
