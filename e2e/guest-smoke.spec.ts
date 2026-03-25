import { expect, test } from "@playwright/test";

test.describe("guest mode", () => {
  test("continue as guest reaches the document list", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /continue as guest/i }).click();

    await expect(page.getByRole("heading", { name: /welcome to glossadocs/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
