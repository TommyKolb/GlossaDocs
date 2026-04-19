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
  const raw = process.env.PROD_FRONTEND_URL?.trim() ?? "";
  if (!raw) {
    throw new Error("PROD_FRONTEND_URL must be set for deployed Playwright tests");
  }
  return raw.replace(/\/+$/, "");
}

export function hasProdE2ECredentials(): boolean {
  const email = process.env.E2E_PROD_EMAIL?.trim() ?? "";
  const password = process.env.E2E_PROD_PASSWORD?.trim() ?? "";
  return Boolean(email && password);
}
