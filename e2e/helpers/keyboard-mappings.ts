import { expect, type Locator, type Page } from "@playwright/test";

export async function openKeyboardMappingsDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /customize english keyboard mappings/i }).click();
  const dialog = page.getByRole("dialog", { name: /customize keyboard/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function saveQMapping(dialog: Locator, physicalKey: string): Promise<void> {
  await dialog.getByLabel("Physical key for letter q").fill(physicalKey);
  await dialog.getByRole("button", { name: /save mappings/i }).click();
}

export async function expectInsertQUsing(page: Page, physicalKey: string): Promise<void> {
  await expect(page.getByRole("button", { name: new RegExp(`insert q using ${physicalKey}`, "i") })).toBeVisible();
}

export async function resetEnglishMappings(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: /^Reset English$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}
