import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isCognitoCompliantPassword, SIGNUP_PASSWORD_MIN_LENGTH } from "@/app/utils/cognito-password-policy";

const repoRoot = path.resolve(path.dirname(fileURLToPath(new URL(import.meta.url))), "..", "..", "..");

describe("cognito password policy (frontend vs CDK vs backend)", () => {
  it("keeps SIGNUP_PASSWORD_MIN_LENGTH aligned with CDK and backend shared module", () => {
    const stack = readFileSync(
      path.join(repoRoot, "infrastructure", "lib", "glossadocs-stack.ts"),
      "utf8"
    );
    const backend = readFileSync(
      path.join(repoRoot, "backend", "src", "shared", "cognito-password-policy.ts"),
      "utf8"
    );
    expect(stack).toMatch(/minLength:\s*12/);
    expect(backend).toMatch(/COGNITO_PASSWORD_MIN_LENGTH = 12/);
    expect(SIGNUP_PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("uses the same pass/fail outcome as the backend for representative passwords", () => {
    const valid = "ValidPass123!Extra";
    const tooShort = "Short1!aA";
    const noSymbol = "ValidPass1234Ab";
    expect(isCognitoCompliantPassword(valid)).toBe(true);
    expect(isCognitoCompliantPassword(tooShort)).toBe(false);
    expect(isCognitoCompliantPassword(noSymbol)).toBe(false);
  });
});
