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

  it("enforces Cognito-aligned password rules", () => {
    expect(isSignupPasswordValid("1234567")).toBe(false);
    expect(isSignupPasswordValid("12345678")).toBe(false);
    expect(isSignupPasswordValid("ValidPass123!Ok")).toBe(true);
  });
});
