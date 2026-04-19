/** Normalize API base: trim and strip trailing slashes (matches SPA `getApiBaseUrl` behavior). */
export function getProdApiBase(): string {
  const raw = process.env.PROD_API_BASE_URL?.trim() ?? "";
  if (!raw) {
    return "";
  }
  return raw.replace(/\/+$/, "");
}

/** Frontend origin for Playwright `baseURL` (no trailing slash). */
export function getProdFrontendOrigin(): string {
  const defaultAmplify = "https://main.d1on78tbp65odj.amplifyapp.com";
  const raw =
    process.env.PROD_FRONTEND_URL?.trim() ||
    process.env.DEPLOYED_FRONTEND_URL?.trim() ||
    defaultAmplify;
  return raw.replace(/\/+$/, "");
}

export function hasProdE2ECredentials(): boolean {
  return Boolean(
    process.env.E2E_PROD_EMAIL?.trim() && process.env.E2E_PROD_PASSWORD && process.env.E2E_PROD_PASSWORD.length > 0
  );
}
