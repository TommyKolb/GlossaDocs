import { describe, expect, it, vi } from "vitest";

import type { Document } from "@/app/models/document";
import { exportAsJson, exportDocument, type ExportFormat } from "@/app/utils/export";

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

describe("exportDocument", () => {
  it("throws for unsupported format", async () => {
    await expect(exportDocument(minimalDoc(), "nope" as ExportFormat)).rejects.toThrow(/unsupported export format/i);
  });
});

describe("exportAsJson", () => {
  it("triggers a download with JSON payload", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.fn();
    const anchor = { click, href: "", download: "" } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportAsJson(minimalDoc({ title: "My Title" }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe("My Title.glossadoc.json");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
