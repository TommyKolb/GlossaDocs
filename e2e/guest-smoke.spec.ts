import { expect, test } from "@playwright/test";

import { expectInsertQUsing, openKeyboardMappingsDialog, saveQMapping } from "./helpers/keyboard-mappings";

test.describe("guest mode", () => {
  test("continue as guest reaches the document list", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /continue as guest/i }).click();

    await expect(page.getByRole("heading", { name: /welcome to glossadocs/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("custom keyboard mappings persist after reload in guest mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /continue as guest/i }).click();
    await expect(page.getByRole("heading", { name: /welcome to glossadocs/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /create a new document/i }).click();
    await expect(page.getByRole("textbox", { name: /document editor for/i })).toBeVisible();

    const dialog = await openKeyboardMappingsDialog(page);
    await saveQMapping(dialog, "9");
    await expectInsertQUsing(page, "9");

    // Persist the new document to IndexedDB before reload (autosave is 10s; reload sooner leaves the list empty).
    await page.keyboard.press("Control+s");
    await expect(page.getByLabel(/All changes are saved/i)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: /welcome to glossadocs/i })).toBeVisible({
      timeout: 20_000,
    });

    // Reload clears React state; guest settings persist in localStorage but the UI returns to the document list.
    const firstDocCard = page.getByRole("group", { name: /open document:/i }).first();
    await expect(firstDocCard).toBeVisible({ timeout: 30_000 });
    await firstDocCard.click();
    await expect(page.getByRole("textbox", { name: /document editor for/i })).toBeVisible();

    await expectInsertQUsing(page, "9");
  });
});
