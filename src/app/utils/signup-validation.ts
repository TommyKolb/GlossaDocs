/**
 * Mirrors backend `auth-register-routes` rules so the UI can enable submit only when
 * the server will accept the payload (z.string().email() + password min 8).
 */

export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

/** Aligns with typical `z.string().email()` expectations (rejects values like `a@a`). */
export function isSignupEmailValid(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Requires a domain with at least one dot (covers common invalid short forms).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isSignupPasswordValid(password: string): boolean {
  return password.length >= SIGNUP_PASSWORD_MIN_LENGTH;
}
