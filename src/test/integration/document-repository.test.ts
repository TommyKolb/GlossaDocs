import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/app/api/client";

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

/** `clearAllMocks` clears `vi.fn()` implementations; restore auth default so `isAuthenticatedMode()` is truthy. */
async function restoreAuthenticatedSessionMock(): Promise<void> {
  const { isAuthenticatedMode } = await import("@/app/data/session-mode");
  vi.mocked(isAuthenticatedMode).mockReturnValue(true);
}

describe("document repository remote persistence", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await restoreAuthenticatedSessionMock();
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
      fontFamily: "Inter",
      createdAt: createdAtIso,
      updatedAt: createdAtIso
    });

    const localDraft = {
      id: "2f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
      title: "Draft",
      content: "<p>hello</p>",
      language: "en" as const,
      folderId: null,
      fontFamily: "Inter",
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
      folderId: null,
      fontFamily: "Inter"
    });
  });

  it("maps folderId and fontFamily from API document payload", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.list).mockResolvedValue([
      {
        id: "7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
        ownerId: "actor-1",
        title: "Draft",
        content: "<p>hello</p>",
        language: "en",
        folderId: "11111111-1111-4111-8111-000000000001",
        fontFamily: "Lora",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z"
      }
    ]);
    const { getAllDocuments } = await import("@/app/data/document-repository");

    const docs = await getAllDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.folderId).toBe("11111111-1111-4111-8111-000000000001");
    expect(docs[0]?.fontFamily).toBe("Lora");
  });
});

const remoteDoc = {
  id: "7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
  ownerId: "actor-1",
  title: "Draft",
  content: "<p>hello</p>",
  language: "en" as const,
  folderId: null as string | null,
  fontFamily: "Inter",
  createdAt: "2026-03-10T12:00:00.000Z",
  updatedAt: "2026-03-10T12:00:00.000Z"
};

describe("document repository authenticated get/save/delete", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await restoreAuthenticatedSessionMock();
  });

  it("getDocument returns null for non-UUID ids without calling the API", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    const { getDocument } = await import("@/app/data/document-repository");

    const result = await getDocument("local-draft-id");

    expect(result).toBeNull();
    expect(documentsApi.get).not.toHaveBeenCalled();
  });

  it("getDocument returns null when the server responds 404", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.get).mockRejectedValue(new ApiClientError("not found", 404));

    const { getDocument } = await import("@/app/data/document-repository");

    await expect(getDocument("7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9")).resolves.toBeNull();
  });

  it("getDocument rethrows non-404 API errors", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.get).mockRejectedValue(new ApiClientError("server", 500));

    const { getDocument } = await import("@/app/data/document-repository");

    await expect(getDocument("7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9")).rejects.toMatchObject({
      status: 500
    });
  });

  it("getDocument maps a successful payload into an app document", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.get).mockResolvedValue(remoteDoc);

    const { getDocument } = await import("@/app/data/document-repository");

    const doc = await getDocument("7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9");
    expect(doc?.id).toBe(remoteDoc.id);
    expect(doc?.title).toBe("Draft");
    expect(doc?.createdAt).toBe(Date.parse(remoteDoc.createdAt));
  });

  it("deleteDocument is a no-op for non-UUID ids in authenticated mode", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    const { deleteDocument } = await import("@/app/data/document-repository");

    await deleteDocument("not-a-uuid");

    expect(documentsApi.remove).not.toHaveBeenCalled();
  });

  it("deleteDocument calls remove for a valid UUID", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.remove).mockResolvedValue(undefined);

    const { deleteDocument } = await import("@/app/data/document-repository");

    await deleteDocument("7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9");

    expect(documentsApi.remove).toHaveBeenCalledWith("7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9");
  });

  it("saveDocument updates when the id was listed by getAllDocuments", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.list).mockResolvedValue([remoteDoc]);
    vi.mocked(documentsApi.update).mockResolvedValue({
      ...remoteDoc,
      title: "Renamed",
      updatedAt: "2026-03-11T12:00:00.000Z"
    });

    const { getAllDocuments, saveDocument } = await import("@/app/data/document-repository");

    await getAllDocuments();
    await saveDocument({
      id: remoteDoc.id,
      title: "Renamed",
      content: remoteDoc.content,
      language: remoteDoc.language,
      folderId: remoteDoc.folderId,
      fontFamily: remoteDoc.fontFamily,
      createdAt: Date.parse(remoteDoc.createdAt),
      updatedAt: Date.parse(remoteDoc.updatedAt)
    });

    expect(documentsApi.create).not.toHaveBeenCalled();
    expect(documentsApi.update).toHaveBeenCalledWith(remoteDoc.id, {
      title: "Renamed",
      content: remoteDoc.content,
      language: remoteDoc.language,
      folderId: remoteDoc.folderId,
      fontFamily: remoteDoc.fontFamily
    });
  });

  it("saveDocument recreates via create when update returns 404", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.list).mockResolvedValue([remoteDoc]);
    vi.mocked(documentsApi.update).mockRejectedValue(new ApiClientError("gone", 404));
    const recreated = {
      ...remoteDoc,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Recovered",
      updatedAt: "2026-03-12T12:00:00.000Z"
    };
    vi.mocked(documentsApi.create).mockResolvedValue(recreated);

    const { getAllDocuments, saveDocument } = await import("@/app/data/document-repository");

    await getAllDocuments();
    const out = await saveDocument({
      id: remoteDoc.id,
      title: "Recovered",
      content: remoteDoc.content,
      language: remoteDoc.language,
      folderId: remoteDoc.folderId,
      fontFamily: remoteDoc.fontFamily,
      createdAt: Date.parse(remoteDoc.createdAt),
      updatedAt: Date.parse(remoteDoc.updatedAt)
    });

    expect(documentsApi.create).toHaveBeenCalledWith({
      title: "Recovered",
      content: remoteDoc.content,
      language: remoteDoc.language,
      folderId: remoteDoc.folderId,
      fontFamily: remoteDoc.fontFamily
    });
    expect(out.id).toBe(recreated.id);
  });

  it("saveDocument treats a plain object with status 404 like ApiClientError on update", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.list).mockResolvedValue([remoteDoc]);
    vi.mocked(documentsApi.update).mockRejectedValue({ status: 404 });
    const recreated = {
      ...remoteDoc,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Recovered",
      updatedAt: "2026-03-12T12:00:00.000Z"
    };
    vi.mocked(documentsApi.create).mockResolvedValue(recreated);

    const { getAllDocuments, saveDocument } = await import("@/app/data/document-repository");

    await getAllDocuments();
    const out = await saveDocument({
      id: remoteDoc.id,
      title: "Recovered",
      content: remoteDoc.content,
      language: remoteDoc.language,
      folderId: remoteDoc.folderId,
      fontFamily: remoteDoc.fontFamily,
      createdAt: Date.parse(remoteDoc.createdAt),
      updatedAt: Date.parse(remoteDoc.updatedAt)
    });

    expect(documentsApi.create).toHaveBeenCalled();
    expect(out.id).toBe(recreated.id);
  });

  it("saveDocument rethrows when update fails with a non-404 error", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.list).mockResolvedValue([remoteDoc]);
    vi.mocked(documentsApi.update).mockRejectedValue(new Error("network"));

    const { getAllDocuments, saveDocument } = await import("@/app/data/document-repository");

    await getAllDocuments();
    await expect(
      saveDocument({
        id: remoteDoc.id,
        title: "X",
        content: remoteDoc.content,
        language: remoteDoc.language,
        folderId: remoteDoc.folderId,
        fontFamily: remoteDoc.fontFamily,
        createdAt: Date.parse(remoteDoc.createdAt),
        updatedAt: Date.parse(remoteDoc.updatedAt)
      })
    ).rejects.toThrow("network");
  });

  it("moveDocumentToFolder sends a folder-only update payload", async () => {
    const { documentsApi } = await import("@/app/api/endpoints");
    vi.mocked(documentsApi.update).mockResolvedValue({
      ...remoteDoc,
      title: "Should stay unchanged on server",
      content: "<p>fresh content</p>",
      folderId: "11111111-1111-4111-8111-000000000001"
    });

    const { moveDocumentToFolder } = await import("@/app/data/document-repository");

    await moveDocumentToFolder(
      "7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9",
      "11111111-1111-4111-8111-000000000001"
    );

    expect(documentsApi.update).toHaveBeenCalledWith("7f7c2b2b-f95d-4b38-9155-d2bd5ce3e4d9", {
      folderId: "11111111-1111-4111-8111-000000000001"
    });
    expect(documentsApi.create).not.toHaveBeenCalled();
  });
});

describe("document repository guest mode documents", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { isAuthenticatedMode } = await import("@/app/data/session-mode");
    vi.mocked(isAuthenticatedMode).mockReturnValue(false);
  });

  it("delegates document CRUD to IndexedDB helpers when unauthenticated", async () => {
    const dbUtils = await import("@/app/utils/db");
    const { getAllDocuments, getDocument, saveDocument, deleteDocument } = await import(
      "@/app/data/document-repository"
    );

    const localDoc = {
      id: "guest-doc-1",
      title: "Local",
      content: "<p>x</p>",
      language: "en" as const,
      folderId: null,
      fontFamily: "Inter",
      createdAt: 1,
      updatedAt: 2
    };

    vi.mocked(dbUtils.getAllDocuments).mockResolvedValue([localDoc]);
    vi.mocked(dbUtils.getDocument).mockResolvedValue(localDoc);
    vi.mocked(dbUtils.saveDocument).mockResolvedValue(undefined);
    vi.mocked(dbUtils.deleteDocument).mockResolvedValue(undefined);

    const list = await getAllDocuments();
    const one = await getDocument("guest-doc-1");
    await saveDocument(localDoc);
    await deleteDocument("guest-doc-1");

    expect(list).toEqual([localDoc]);
    expect(one).toEqual(localDoc);
    expect(dbUtils.saveDocument).toHaveBeenCalledWith(localDoc);
    expect(dbUtils.deleteDocument).toHaveBeenCalledWith("guest-doc-1");
  });

  it("moveDocumentToFolder updates only local folder assignment in guest mode", async () => {
    const dbUtils = await import("@/app/utils/db");
    const { moveDocumentToFolder } = await import("@/app/data/document-repository");
    const localDoc = {
      id: "guest-doc-2",
      title: "Local",
      content: "<p>x</p>",
      language: "en" as const,
      folderId: null,
      fontFamily: "Inter",
      createdAt: 1,
      updatedAt: 2
    };
    vi.mocked(dbUtils.getDocument).mockResolvedValue(localDoc);
    vi.mocked(dbUtils.saveDocument).mockResolvedValue(undefined);

    await moveDocumentToFolder("guest-doc-2", "folder-1");

    expect(dbUtils.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "guest-doc-2",
        folderId: "folder-1"
      })
    );
  });
});

describe("folder repository in authenticated mode", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await restoreAuthenticatedSessionMock();
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

describe("folder repository authenticated update/delete", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await restoreAuthenticatedSessionMock();
  });

  it("updateFolder calls foldersApi.update when authenticated", async () => {
    const { foldersApi } = await import("@/app/api/endpoints");
    vi.mocked(foldersApi.update).mockResolvedValue({
      id: "11111111-1111-4111-8111-000000000001",
      ownerId: "actor-1",
      name: "Renamed",
      parentFolderId: null,
      createdAt: "2026-03-10T12:00:00.000Z",
      updatedAt: "2026-03-11T12:00:00.000Z"
    });
    const { updateFolder } = await import("@/app/data/document-repository");
    const folder = {
      id: "11111111-1111-4111-8111-000000000001",
      name: "Renamed",
      parentFolderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const out = await updateFolder(folder);

    expect(foldersApi.update).toHaveBeenCalledWith("11111111-1111-4111-8111-000000000001", {
      name: "Renamed",
      parentFolderId: null
    });
    expect(out.name).toBe("Renamed");
  });

  it("deleteFolder calls remove for a valid UUID when authenticated", async () => {
    const { foldersApi } = await import("@/app/api/endpoints");
    vi.mocked(foldersApi.remove).mockResolvedValue(undefined);
    const { deleteFolder } = await import("@/app/data/document-repository");

    await deleteFolder("11111111-1111-4111-8111-000000000001");

    expect(foldersApi.remove).toHaveBeenCalledWith("11111111-1111-4111-8111-000000000001");
  });

  it("deleteFolder skips remove for non-UUID ids when authenticated", async () => {
    const { foldersApi } = await import("@/app/api/endpoints");
    const { deleteFolder } = await import("@/app/data/document-repository");

    await deleteFolder("not-a-uuid");

    expect(foldersApi.remove).not.toHaveBeenCalled();
  });
});

describe("folder repository guest updateFolder", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { isAuthenticatedMode } = await import("@/app/data/session-mode");
    vi.mocked(isAuthenticatedMode).mockReturnValue(false);
  });

  it("updateFolder persists via saveFolder when unauthenticated", async () => {
    const dbUtils = await import("@/app/utils/db");
    vi.mocked(dbUtils.saveFolder).mockResolvedValue(undefined);
    const { updateFolder } = await import("@/app/data/document-repository");
    const folder = {
      id: "11111111-1111-4111-8111-000000000001",
      name: "Renamed",
      parentFolderId: null,
      createdAt: 100,
      updatedAt: 200
    };
    const out = await updateFolder(folder);

    expect(dbUtils.saveFolder).toHaveBeenCalledTimes(1);
    expect(out.name).toBe("Renamed");
    expect(out.updatedAt).toBeGreaterThanOrEqual(200);
  });
});

describe("folder repository in guest mode", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { isAuthenticatedMode } = await import("@/app/data/session-mode");
    vi.mocked(isAuthenticatedMode).mockReturnValue(false);
  });

  it("uses IndexedDB helpers for folder operations when unauthenticated", async () => {
    const dbUtils = await import("@/app/utils/db");
    const { createFolder, getAllFolders, deleteFolder } = await import("@/app/data/document-repository");

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
