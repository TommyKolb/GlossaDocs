import { expect, test } from "@playwright/test";

test("D-FE-01: deployed SPA shows sign-in shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sign in to continue/i })).toBeVisible();
});
