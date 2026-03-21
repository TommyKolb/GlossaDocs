import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/endpoints", () => ({
  documentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock("@/app/data/session-mode", () => ({
  isAuthenticatedMode: vi.fn(() => true)
}));

vi.mock("@/app/utils/db", () => ({
  deleteDocument: vi.fn(),
  getAllDocuments: vi.fn(),
  getDocument: vi.fn(),
  saveDocument: vi.fn()
}));

describe("document repository remote persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates first for unknown UUID in authenticated mode", async () => {
    const [{ saveDocument }, { documentsApi }] = await Promise.all([
      import("@/app/data/document-repository"),
      import("@/app/api/endpoints")
    ]);

    const createdAtIso = "2026-03-10T12:00:00.000Z";
    vi.mocked(documentsApi.create).mockResolvedValue({
      id: "7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
      ownerId: "actor-1",
      title: "Draft",
      content: "<p>hello</p>",
      language: "en",
      createdAt: createdAtIso,
      updatedAt: createdAtIso
    });

    const localDraft = {
      id: "2f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
      title: "Draft",
      content: "<p>hello</p>",
      language: "en" as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveDocument(localDraft);

    expect(documentsApi.update).not.toHaveBeenCalled();
    expect(documentsApi.create).toHaveBeenCalledTimes(1);
    expect(documentsApi.create).toHaveBeenCalledWith({
      title: "Draft",
      content: "<p>hello</p>",
      language: "en"
    });
  });
});
