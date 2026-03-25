import { describe, expect, it } from "vitest";

import type { Document } from "@/app/models/document";
import { buildPdfRenderContainer } from "@/app/utils/export";

function minimalDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Test Doc",
    content: "<p>Hello</p>",
    language: "en",
    folderId: null,
    fontFamily: "serif",
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

/**
 * PDF export must show the same text the user typed in the editor body.
 * The document title is metadata for the file name only; it must not appear inside the PDF body.
 */
describe("PDF export render tree (TDD: body text only)", () => {
  const ownerDoc = document.implementation.createHTMLDocument("pdf");

  it("does not include the document title in the rendered PDF root text", () => {
    const root = buildPdfRenderContainer(
      ownerDoc,
      minimalDoc({
        title: "My Report Title",
        content: "<p>Paragraph one</p><p>Second line</p>",
      })
    );

    const text = root.textContent ?? "";
    expect(text).toContain("Paragraph one");
    expect(text).toContain("Second line");
    expect(text).not.toContain("My Report Title");
  });

  it("does not inject a fallback title label into the PDF body when the title is empty", () => {
    const root = buildPdfRenderContainer(
      ownerDoc,
      minimalDoc({
        title: "",
        content: "<p>Body only</p>",
      })
    );

    const text = root.textContent ?? "";
    expect(text).toContain("Body only");
    expect(text).not.toContain("Untitled Document");
  });

  it("keeps title and body independent when they use different strings", () => {
    const root = buildPdfRenderContainer(
      ownerDoc,
      minimalDoc({
        title: "ZZZ_UNIQUE_TITLE_111",
        content: "<div>AAA_UNIQUE_BODY_222</div>",
      })
    );

    const text = root.textContent ?? "";
    expect(text).toContain("AAA_UNIQUE_BODY_222");
    expect(text).not.toContain("ZZZ_UNIQUE_TITLE_111");
  });

  it("does not add a title element for whitespace-only titles", () => {
    const root = buildPdfRenderContainer(
      ownerDoc,
      minimalDoc({
        title: "   \t  ",
        content: "<p>Real content</p>",
      })
    );

    const text = root.textContent ?? "";
    expect(text).toContain("Real content");
    expect(text.trim()).toBe("Real content");
    expect(root.querySelector("h1.pdf-title")).toBeNull();
  });
});
