import { describe, expect, it } from "vitest";

import { isSignupEmailValid, isSignupPasswordValid } from "@/app/utils/signup-validation";

describe("signup-validation", () => {
  it("rejects obviously invalid emails", () => {
    expect(isSignupEmailValid("")).toBe(false);
    expect(isSignupEmailValid("not-an-email")).toBe(false);
  });

  it("accepts basic email-like values and defers strict checks to backend", () => {
    expect(isSignupEmailValid("a@a")).toBe(true);
    expect(isSignupEmailValid("user@example.com")).toBe(true);
    expect(isSignupEmailValid("  user@example.com  ")).toBe(true);
  });

  it("enforces minimum password length", () => {
    expect(isSignupPasswordValid("1234567")).toBe(false);
    expect(isSignupPasswordValid("12345678")).toBe(true);
  });
});
