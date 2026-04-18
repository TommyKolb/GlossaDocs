import { describe, expect, it } from "vitest";

import {
  cognitoPasswordSchema,
  isCognitoCompliantPassword
} from "../../src/shared/cognito-password-policy.js";

describe("isCognitoCompliantPassword", () => {
  it("accepts passwords that match the Cognito pool policy shape", () => {
    expect(isCognitoCompliantPassword("ValidPass123!Extra")).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(isCognitoCompliantPassword("Short1!a")).toBe(false);
  });

  it("rejects passphrases without required character classes", () => {
    expect(isCognitoCompliantPassword("correct horse battery staple")).toBe(false);
  });
});

describe("cognitoPasswordSchema", () => {
  it("parses compliant passwords", () => {
    expect(cognitoPasswordSchema.parse("ValidPass123!Extra")).toBe("ValidPass123!Extra");
  });

  it("rejects non-compliant passwords", () => {
    expect(() => cognitoPasswordSchema.parse("onlyeight")).toThrow();
  });
});
