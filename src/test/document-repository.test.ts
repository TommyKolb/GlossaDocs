import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/endpoints", () => ({
  documentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  },
  foldersApi: {
    list: vi.fn(),
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
  saveDocument: vi.fn(),
  getAllFolders: vi.fn(),
  saveFolder: vi.fn(),
  deleteFolder: vi.fn()
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
      folderId: null,
      createdAt: createdAtIso,
      updatedAt: createdAtIso
    });

    const localDraft = {
      id: "2f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
      title: "Draft",
      content: "<p>hello</p>",
      language: "en" as const,
      folderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveDocument(localDraft);

    expect(documentsApi.update).not.toHaveBeenCalled();
    expect(documentsApi.create).toHaveBeenCalledTimes(1);
    expect(documentsApi.create).toHaveBeenCalledWith({
      title: "Draft",
      content: "<p>hello</p>",
      language: "en",
      folderId: null
    });
  });

  it("maps folderId from API document payload", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.list).mockResolvedValue([
      {
        id: "7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
        ownerId: "actor-1",
        title: "Draft",
        content: "<p>hello</p>",
        language: "en",
        folderId: "11111111-1111-4111-8111-000000000001",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z"
      }
    ]);
    const { getAllDocuments } = await import("@/app/data/document-repository");

    const docs = await getAllDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.folderId).toBe("11111111-1111-4111-8111-000000000001");
  });
});

describe("folder repository in authenticated mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates and maps folders using API endpoints", async () => {
    const { foldersApi } = await import("@/app/api/endpoints");
    vi.mocked(foldersApi.create).mockResolvedValue({
      id: "11111111-1111-4111-8111-000000000001",
      ownerId: "actor-1",
      name: "Projects",
      parentFolderId: null,
      createdAt: "2026-03-10T12:00:00.000Z",
      updatedAt: "2026-03-10T12:00:00.000Z"
    });
    vi.mocked(foldersApi.list).mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-000000000001",
        ownerId: "actor-1",
        name: "Projects",
        parentFolderId: null,
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z"
      }
    ]);
    const { createFolder, getAllFolders } = await import("@/app/data/document-repository");
    const created = await createFolder("Projects", null);
    const list = await getAllFolders();

    expect(foldersApi.create).toHaveBeenCalledWith({ name: "Projects", parentFolderId: null });
    expect(created.name).toBe("Projects");
    expect(list[0]?.id).toBe("11111111-1111-4111-8111-000000000001");
  });
});

describe("folder repository in guest mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses IndexedDB helpers for folder operations when unauthenticated", async () => {
    vi.doMock("@/app/data/session-mode", () => ({
      isAuthenticatedMode: vi.fn(() => false)
    }));
    const [{ createFolder, getAllFolders, deleteFolder }, dbUtils] = await Promise.all([
      import("@/app/data/document-repository"),
      import("@/app/utils/db")
    ]);

    vi.mocked(dbUtils.saveFolder).mockResolvedValue(undefined);
    vi.mocked(dbUtils.getAllFolders).mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-000000000001",
        name: "Guest Folder",
        parentFolderId: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ]);
    vi.mocked(dbUtils.deleteFolder).mockResolvedValue(undefined);

    await createFolder("Guest Folder", null);
    const folders = await getAllFolders();
    await deleteFolder("11111111-1111-4111-8111-000000000001");

    expect(dbUtils.saveFolder).toHaveBeenCalledTimes(1);
    expect(folders).toHaveLength(1);
    expect(dbUtils.deleteFolder).toHaveBeenCalledWith("11111111-1111-4111-8111-000000000001");
  });
});
