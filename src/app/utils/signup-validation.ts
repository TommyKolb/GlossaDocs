/**
 * Keep frontend checks intentionally coarse and let the backend stay the source of truth.
 * This avoids drift with server-side zod validation.
 */

export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

/** Basic UX check only. The backend performs full validation. */
export function isSignupEmailValid(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return trimmed.includes("@");
}

export function isSignupPasswordValid(password: string): boolean {
  return password.length >= SIGNUP_PASSWORD_MIN_LENGTH;
}
