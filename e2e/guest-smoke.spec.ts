import { expect, test } from "@playwright/test";

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

    await page.getByRole("button", { name: /customize english keyboard mappings/i }).click();
    const dialog = page.getByRole("dialog", { name: /customize keyboard/i });
    await dialog.getByLabel("Physical key for letter q").fill("9");
    await dialog.getByRole("button", { name: /save mappings/i }).click();

    await expect(page.getByRole("button", { name: /insert q using 9/i })).toBeVisible();

    await page.reload();
    const remappedQ = page.getByRole("button", { name: /insert q using 9/i });
    try {
      await expect(remappedQ).toBeVisible({ timeout: 5_000 });
    } catch {
      const existingDocument = page.getByRole("group", { name: /open document:/i }).first();
      if ((await existingDocument.count()) > 0) {
        await existingDocument.click();
      } else {
        await page.getByRole("button", { name: /create a new document/i }).click();
      }
    }

    await expect(remappedQ).toBeVisible();
  });
});
