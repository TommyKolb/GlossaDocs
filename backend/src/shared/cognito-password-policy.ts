import { z } from "zod";

/**
 * Must stay aligned with `UserPool` `passwordPolicy` in
 * `infrastructure/lib/glossadocs-stack.ts` (min 12 + complexity).
 */
export const COGNITO_PASSWORD_MIN_LENGTH = 12;

const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.";

export function isCognitoCompliantPassword(password: string): boolean {
  if (password.length < COGNITO_PASSWORD_MIN_LENGTH) {
    return false;
  }
  if (!/[a-z]/.test(password)) {
    return false;
  }
  if (!/[A-Z]/.test(password)) {
    return false;
  }
  if (!/\d/.test(password)) {
    return false;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return false;
  }
  return true;
}

export const cognitoPasswordSchema = z
  .string()
  .min(COGNITO_PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .refine(isCognitoCompliantPassword, { message: PASSWORD_POLICY_MESSAGE });

export const cognitoRegisterPasswordSchema = cognitoPasswordSchema;
