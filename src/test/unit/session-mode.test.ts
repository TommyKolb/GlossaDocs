import { beforeEach, describe, expect, it } from "vitest";

import { isAuthenticatedMode } from "@/app/data/session-mode";
import { setSessionOverride } from "@/app/utils/auth";

describe("isAuthenticatedMode", () => {
  beforeEach(() => {
    setSessionOverride(undefined);
    localStorage.clear();
  });

  it("returns false when override forces unknown session", () => {
    localStorage.setItem(
      "glossadocs_user",
      JSON.stringify({ id: "user-1", username: "alice", email: "alice@example.com", isGuest: false })
    );
    setSessionOverride(null);
    expect(isAuthenticatedMode()).toBe(false);
  });

  it("returns true for authenticated override", () => {
    setSessionOverride({ id: "user-2", username: "alice", email: "alice@example.com", isGuest: false });
    expect(isAuthenticatedMode()).toBe(true);
  });
});
