import { expect, test, type Page } from "@playwright/test";

import { clickCreateDocument, expectPostLoginDocumentListVisible, loginProdUser } from "./auth-helpers";
import { cleanupE2EAccountData } from "./cleanup-e2e-account";
import { hasProdE2ECredentials } from "./env";

const describeSerialOrSkip = hasProdE2ECredentials() ? test.describe.serial : test.describe.skip;

describeSerialOrSkip("D-AUTH / D-DOC / D-FLD / D-SET — authenticated deployed integration", () => {
  let page: Page;
  let e2eDocTitle: string;
  let e2eDocBody: string;
  let e2eFolderName: string;

  test.beforeAll(() => {
    const runId = Date.now();
    e2eDocTitle = `E2E-DOC-${runId}`;
    e2eDocBody = `E2E-body-${runId}`;
    e2eFolderName = `E2E-FLD-${runId}`;
  });

  test("D-AUTH-01: login reaches authenticated shell", async ({ browser }) => {
    page = await browser.newPage();
    await loginProdUser(page);
    await expect(page.getByText(/signed in as/i)).toBeVisible();
  });

  test("D-AUTH-02: session survives full reload", async () => {
    await page.reload();
    await expectPostLoginDocumentListVisible(page);
    await expect(page.getByText(/signed in as/i)).toBeVisible();
  });

  test("D-AUTH-03: document list loads without error banner", async () => {
    await expect(page.getByText("Failed to load documents")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /welcome to glossadocs/i })).toBeVisible();
  });

  test("D-DOC-01: create document opens editor", async () => {
    await clickCreateDocument(page);
    await expect(page.getByRole("textbox", { name: /document editor for/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("D-DOC-02: save document to server", async () => {
    await page.getByLabel("Document title").fill(e2eDocTitle);
    const editor = page.getByRole("textbox", {
      name: new RegExp(`Document editor for ${e2eDocTitle}`, "i"),
    });
    await editor.click();
    await page.keyboard.type(e2eDocBody);
    await page.keyboard.press("Control+s");
    await expect(page.getByLabel(/all changes are saved/i)).toBeVisible({ timeout: 25_000 });
  });

  test("D-DOC-03: document body survives reload", async () => {
    await page.reload();
    await expectPostLoginDocumentListVisible(page);
    const card = page.getByRole("group", { name: new RegExp(`Open document: ${e2eDocTitle}`, "i") });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    const editorTextbox = page.getByRole("textbox", { name: /document editor for/i });
    await expect(editorTextbox).toBeVisible();
    // With the on-screen keyboard visible, Editor remaps key events to layout output (unshifted
    // Latin becomes lowercase); Playwright's keyboard.type("E2E-…") therefore persists as "e2e-…".
    await expect(editorTextbox).toContainText(
      new RegExp(e2eDocBody.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  });

  test("D-FLD-01: create folder", async () => {
    await page.getByRole("button", { name: "Back to document list" }).click();
    await expect(page.getByRole("heading", { name: /welcome to glossadocs/i })).toBeVisible();
    await page.getByRole("button", { name: "New Folder" }).click();
    await page.getByLabel("Folder name").fill(e2eFolderName);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(`Open folder ${e2eFolderName}`, "i") }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("D-DOC-04: delete document", async () => {
    const deleteBtn = page.getByRole("button", {
      name: new RegExp(`Delete document: ${e2eDocTitle}`, "i"),
    });
    await deleteBtn.click();
    const confirmDelete = page.getByRole("alertdialog");
    await confirmDelete.getByRole("button", { name: /^Delete$/ }).click();
    await expect(page.getByRole("group", { name: new RegExp(e2eDocTitle, "i") })).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("D-SET-01: keyboard mapping persists and resets", async () => {
    await clickCreateDocument(page);
    await expect(page.getByRole("textbox", { name: /document editor for/i })).toBeVisible();
    await page.getByRole("button", { name: /customize english keyboard mappings/i }).click();
    const dialog = page.getByRole("dialog", { name: /customize keyboard/i });
    await dialog.getByLabel("Physical key for letter q").fill("9");
    await dialog.getByRole("button", { name: "Save mappings" }).click();
    await expect(page.getByRole("button", { name: /insert q using 9/i })).toBeVisible();

    await page.reload();
    await expectPostLoginDocumentListVisible(page);

    await clickCreateDocument(page);
    await page.getByRole("button", { name: /customize english keyboard mappings/i }).click();
    const dialog2 = page.getByRole("dialog", { name: /customize keyboard/i });
    await expect(dialog2.getByLabel("Physical key for letter q")).toHaveValue("9");

    await dialog2.getByRole("button", { name: /^Reset English$/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset" }).click();
    // Reset confirm calls onSave + closes the dialog (no second "Save mappings" — see KeyboardMappingDialog.applyResetLanguage).
    await expect(dialog2).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /insert q using q/i })).toBeVisible({ timeout: 15_000 });
  });

  test.afterAll(async () => {
    try {
      if (page && hasProdE2ECredentials()) {
        await cleanupE2EAccountData(page);
      }
    } catch {
      /* ignore cleanup failures (e.g. expired session) */
    }
    await page?.close();
  });
});
