import { describe, expect, it, vi } from "vitest";

import {
  exportAsJson,
  exportDocument,
  htmlToDocxParagraphModels,
  htmlToPlainText,
  type ExportFormat
} from "@/app/utils/export";
import { minimalDocumentFixture } from "@/test/fixtures/document";

describe("exportDocument", () => {
  it("throws for unsupported format", async () => {
    await expect(exportDocument(minimalDocumentFixture(), "nope" as ExportFormat)).rejects.toThrow(
      /unsupported export format/i
    );
  });
});

describe("exportAsJson", () => {
  it("triggers a download with JSON payload", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.fn();
    const anchor = { click, href: "", download: "" } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportAsJson(minimalDocumentFixture({ title: "My Title" }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe("My Title.glossadoc.json");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    createElementSpy.mockRestore();
  });
});

describe("text export helpers", () => {
  it("preserves line breaks between block elements and <br> tags", () => {
    const plainText = htmlToPlainText("<p>First line</p><p>Second line<br>with break</p><div>Third</div>");
    expect(plainText).toBe("First line\nSecond line\nwith break\nThird");
  });
});

describe("docx export helpers", () => {
  it("keeps inline bold/italic styling scoped to each run", () => {
    const paragraphs = htmlToDocxParagraphModels("<p>Hello <strong>bold</strong> and <em>italic</em>.</p>");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]?.runs).toEqual([
      { text: "Hello ", bold: undefined, italics: undefined, underline: undefined },
      { text: "bold", bold: true, italics: undefined, underline: undefined },
      { text: " and ", bold: undefined, italics: undefined, underline: undefined },
      { text: "italic", bold: undefined, italics: true, underline: undefined },
      { text: ".", bold: undefined, italics: undefined, underline: undefined }
    ]);
  });
});
