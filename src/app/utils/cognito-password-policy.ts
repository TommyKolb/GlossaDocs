/**
 * Mirrors `backend/src/shared/cognito-password-policy.ts` and CDK `UserPool` `passwordPolicy`.
 * Keep the rules in sync when infrastructure changes.
 */
export const SIGNUP_PASSWORD_MIN_LENGTH = 12;

export function isCognitoCompliantPassword(password: string): boolean {
  if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
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

export const SIGNUP_PASSWORD_POLICY_HINT =
  "At least 12 characters with uppercase, lowercase, a number, and a symbol.";
