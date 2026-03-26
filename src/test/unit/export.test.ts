import { describe, expect, it, vi } from "vitest";

import { exportAsJson, exportDocument, type ExportFormat } from "@/app/utils/export";
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
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportAsJson(minimalDocumentFixture({ title: "My Title" }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe("My Title.glossadoc.json");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
