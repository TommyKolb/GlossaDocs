/**
 * Email checks are coarse UX hints. Password rules mirror Cognito (see `cognito-password-policy.ts`)
 * and backend zod validation.
 */

import {
  SIGNUP_PASSWORD_MIN_LENGTH,
  isCognitoCompliantPassword,
  SIGNUP_PASSWORD_POLICY_HINT
} from "./cognito-password-policy";

export { SIGNUP_PASSWORD_MIN_LENGTH, SIGNUP_PASSWORD_POLICY_HINT };

/** Basic UX check only. The backend performs full validation. */
export function isSignupEmailValid(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return trimmed.includes("@");
}

export function isSignupPasswordValid(password: string): boolean {
  return isCognitoCompliantPassword(password);
}
