import { request, type Page } from "@playwright/test";

import { getProdApiBase } from "./env";

interface IdRow {
  id: string;
}

/**
 * Best-effort cleanup for the E2E Cognito user: delete all documents and folders and clear
 * keyboard layout overrides. Uses the same session cookies as `page` (requires PROD_API_BASE_URL).
 */
export async function cleanupE2EAccountData(page: Page): Promise<void> {
  const base = getProdApiBase();
  if (!base) {
    return;
  }

  const storageState = await page.context().storageState();
  const api = await request.newContext({
    baseURL: base,
    storageState,
    extraHTTPHeaders: { Accept: "application/json" },
  });

  try {
    const docsRes = await api.get("/documents");
    if (docsRes.ok()) {
      const docs = (await docsRes.json()) as IdRow[];
      for (const doc of docs) {
        await api.delete(`/documents/${doc.id}`);
      }
    }

    for (let safety = 0; safety < 50; safety++) {
      const foldersRes = await api.get("/folders");
      if (!foldersRes.ok()) {
        break;
      }
      const folders = (await foldersRes.json()) as IdRow[];
      if (folders.length === 0) {
        break;
      }
      await api.delete(`/folders/${folders[0].id}`);
    }

    await api.put("/settings", {
      data: { keyboardLayoutOverrides: {} },
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    await api.dispose();
  }
}
