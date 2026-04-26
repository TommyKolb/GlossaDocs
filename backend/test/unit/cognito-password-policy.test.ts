import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  COGNITO_PASSWORD_MIN_LENGTH,
  cognitoPasswordSchema,
  isCognitoCompliantPassword
} from "../../src/shared/cognito-password-policy.js";

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

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

describe("CDK and shared policy alignment", () => {
  it("keeps min length and complexity in sync with UserPool in glossadocs-stack", () => {
    const stack = readFileSync(
      path.join(repoRoot, "infrastructure", "lib", "glossadocs-stack.ts"),
      "utf8"
    );
    expect(stack).toMatch(/minLength:\s*12/);
    expect(stack).toMatch(/requireLowercase:\s*true/);
    expect(stack).toMatch(/requireUppercase:\s*true/);
    expect(stack).toMatch(/requireDigits:\s*true/);
    expect(stack).toMatch(/requireSymbols:\s*true/);
    expect(COGNITO_PASSWORD_MIN_LENGTH).toBe(12);
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
