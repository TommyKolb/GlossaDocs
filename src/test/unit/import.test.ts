import { describe, expect, it } from "vitest";

import { importDocumentFile, isSupportedDocumentFile } from "@/app/utils/import";

describe("isSupportedDocumentFile", () => {
  it("accepts .txt and .docx case-insensitively", () => {
    expect(isSupportedDocumentFile(new File([], "notes.TXT", { type: "text/plain" }))).toBe(true);
    expect(isSupportedDocumentFile(new File([], "paper.DocX", { type: "application/zip" }))).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isSupportedDocumentFile(new File([], "x.pdf", { type: "application/pdf" }))).toBe(false);
    expect(isSupportedDocumentFile(new File([], "noext", { type: "application/octet-stream" }))).toBe(false);
  });
});

describe("importDocumentFile", () => {
  it("rejects unsupported formats", async () => {
    await expect(
      importDocumentFile(new File([], "readme.pdf", { type: "application/pdf" }))
    ).rejects.toThrow(/unsupported file format/i);
  });
});
