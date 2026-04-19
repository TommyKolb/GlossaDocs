import type { Page } from "@playwright/test";

import { getProdApiBase } from "./env";

interface IdRow {
  id: string;
}

async function getFailurePreview(response: { text(): Promise<string> }): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "unable to read response body";
  }
}

async function deleteOrWarn(
  warnings: string[],
  endpoint: string,
  requestDelete: () => Promise<{ ok(): boolean; status(): number; text(): Promise<string> }>,
): Promise<void> {
  const res = await requestDelete();
  if (res.ok()) {
    return;
  }
  const preview = await getFailurePreview(res);
  warnings.push(`DELETE ${endpoint} failed (${res.status()}): ${preview}`);
}

/**
 * Best-effort cleanup for the E2E Cognito user: delete all documents and folders and clear
 * keyboard layout overrides using the current browser context's authenticated session.
 */
export async function cleanupE2EAccountData(page: Page): Promise<string[]> {
  const warnings: string[] = [];
  const base = getProdApiBase();
  if (!base) {
    warnings.push("Skipping cleanup because PROD_API_BASE_URL is unset.");
    return warnings;
  }

  const api = page.context().request;

  const sessionRes = await api.get(`${base}/auth/session`, {
    headers: { Accept: "application/json" },
  });
  if (!sessionRes.ok()) {
    const preview = await getFailurePreview(sessionRes);
    warnings.push(`GET /auth/session failed (${sessionRes.status()}): ${preview}`);
    return warnings;
  }

  const docsRes = await api.get(`${base}/documents`, {
    headers: { Accept: "application/json" },
  });
  if (docsRes.ok()) {
    const docs = (await docsRes.json()) as IdRow[];
    for (const doc of docs) {
      await deleteOrWarn(warnings, `/documents/${doc.id}`, () =>
        api.delete(`${base}/documents/${doc.id}`, { headers: { Accept: "application/json" } }),
      );
    }
  } else {
    const preview = await getFailurePreview(docsRes);
    warnings.push(`GET /documents failed (${docsRes.status()}): ${preview}`);
  }

  for (let safety = 0; safety < 50; safety++) {
    const foldersRes = await api.get(`${base}/folders`, {
      headers: { Accept: "application/json" },
    });
    if (!foldersRes.ok()) {
      const preview = await getFailurePreview(foldersRes);
      warnings.push(`GET /folders failed (${foldersRes.status()}): ${preview}`);
      break;
    }
    const folders = (await foldersRes.json()) as IdRow[];
    if (folders.length === 0) {
      break;
    }
    await deleteOrWarn(warnings, `/folders/${folders[0].id}`, () =>
      api.delete(`${base}/folders/${folders[0].id}`, { headers: { Accept: "application/json" } }),
    );
  }

  const settingsRes = await api.put(`${base}/settings`, {
    data: { keyboardLayoutOverrides: {} },
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });
  if (!settingsRes.ok()) {
    const preview = await getFailurePreview(settingsRes);
    warnings.push(`PUT /settings failed (${settingsRes.status()}): ${preview}`);
  }

  return warnings;
}
