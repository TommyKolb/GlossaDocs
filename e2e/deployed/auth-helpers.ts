import { expect, type Page } from "@playwright/test";

/** Max time for POST /auth/login + session + first document list load. */
const LOGIN_FLOW_TIMEOUT_MS = 90_000;
/** Max wait for `/documents` + `/folders` after the document list mounts. */
export const DOCUMENT_LIST_TIMEOUT_MS = 60_000;

/** Distinct strings that appear only after leaving the login card or when login explicitly fails. */
const LOGIN_OUTCOME_RE =
  /Welcome to GlossaDocs|Loading documents\.\.\.|Login failed|Create New Document|Create a new document|Create your first document/i;

/**
 * After auth, the shell may show the app bootstrap spinner, then "Loading documents…"
 * (DocumentList does not render the "Welcome to GlossaDocs" hero until loading finishes).
 */
export async function expectPostLoginDocumentListVisible(page: Page): Promise<void> {
  const welcomeHeading = page.getByRole("heading", { name: /welcome to glossadocs/i });
  const loadingDocs = page.getByText("Loading documents...", { exact: true });
  const appBootstrapLoading = page.getByText("Loading...", { exact: true });

  await expect(welcomeHeading.or(loadingDocs).or(appBootstrapLoading)).toBeVisible({
    timeout: 30_000,
  });

  await expect(appBootstrapLoading).toBeHidden({ timeout: 30_000 });
  await expect(loadingDocs).toBeHidden({ timeout: DOCUMENT_LIST_TIMEOUT_MS });
  await expect(welcomeHeading).toBeVisible({ timeout: 15_000 });
}

export async function loginProdUser(page: Page): Promise<void> {
  const email = process.env.E2E_PROD_EMAIL?.trim();
  const password = process.env.E2E_PROD_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_PROD_EMAIL and E2E_PROD_PASSWORD must be set");
  }

  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  const loginError = page.locator("#login-error");
  const signInCard = page.getByRole("heading", { name: /sign in to continue/i });

  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Role-based OR misses: (1) long "Signing in…" with no response, (2) Sonner toast-only errors.
  // Login page copy never contains "Welcome to GlossaDocs" (only the animated word "Welcome").
  await expect(page.locator("body")).toContainText(LOGIN_OUTCOME_RE, {
    timeout: LOGIN_FLOW_TIMEOUT_MS,
  });

  if (await signInCard.isVisible()) {
    if (await loginError.isVisible()) {
      const msg = (await loginError.textContent())?.trim() ?? "unknown";
      throw new Error(
        `Login failed (inline): ${msg}. Check E2E_PROD_EMAIL / E2E_PROD_PASSWORD and that PROD_FRONTEND_URL matches the Amplify app you open manually.`,
      );
    }
    const bodyPreview = (await page.locator("body").innerText()).slice(0, 600);
    throw new Error(
      `Login did not finish: still on the sign-in screen after ${LOGIN_FLOW_TIMEOUT_MS}ms. ` +
        `Typical causes: POST https://…/auth/login never completes in this environment (proxy/VPN/firewall), ` +
        `or PROD_FRONTEND_URL points at a different deployment than you use in a normal browser. ` +
        `Body preview: ${JSON.stringify(bodyPreview)}`,
    );
  }

  await expectPostLoginDocumentListVisible(page);
}

/** Primary or empty-state "create document" control. */
export async function clickCreateDocument(page: Page): Promise<void> {
  const create = page.getByRole("button", {
    name: /create (a )?new document|new document|create your first document|first document/i,
  });
  await create.first().click();
}
