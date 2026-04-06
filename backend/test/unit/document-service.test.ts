import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/shared/api-error.js";
import { DocumentService } from "../../src/modules/documents/document-service.js";
import type { CreateDocumentDto } from "../../src/modules/documents/types.js";
import { EmptyRepository, RecordingRepository } from "../helpers/document-repository-fakes.js";

describe("DocumentService invariants", () => {
  it("throws a contract error for empty update payload", async () => {
    const service = new DocumentService(new EmptyRepository());

    await expect(service.updateOwned("actor-1", "doc-1", {})).rejects.toMatchObject({
      code: "DOCUMENT_UPDATE_EMPTY",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });
});

describe("DocumentService sanitization", () => {
  it("createOwned passes sanitized title and content to repository (no script or HTML in title)", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const payload: CreateDocumentDto = {
      title: "<script>alert(1)</script>Real title",
      content: "<p>Safe</p>",
      language: "en"
    };

    await service.createOwned("actor-1", payload);

    expect(repo.lastInsertPayload).not.toBeNull();
    expect(repo.lastInsertPayload!.title).not.toContain("script");
    expect(repo.lastInsertPayload!.title).not.toContain("alert");
    expect(repo.lastInsertPayload!.title).toContain("Real title");
    expect(repo.lastInsertPayload!.content).toBe("<p>Safe</p>");
  });

  it("createOwned passes sanitized content to repository (script and handlers stripped)", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const payload: CreateDocumentDto = {
      title: "Doc",
      content: "<p>OK</p><script>evil()</script><div onclick=\"bad()\">X</div>",
      language: "en"
    };

    await service.createOwned("actor-1", payload);

    expect(repo.lastInsertPayload!.content).not.toContain("script");
    expect(repo.lastInsertPayload!.content).not.toContain("evil");
    expect(repo.lastInsertPayload!.content).not.toContain("onclick");
    expect(repo.lastInsertPayload!.content).not.toContain("bad");
    expect(repo.lastInsertPayload!.content).toContain("OK");
    expect(repo.lastInsertPayload!.content).toContain("X");
  });

  it("updateOwned passes sanitized title when title is provided", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);

    await service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
      title: "<b>Bold title</b>"
    });

    expect(repo.lastUpdatePatch).not.toBeNull();
    expect(repo.lastUpdatePatch!.title).not.toContain("<");
    expect(repo.lastUpdatePatch!.title).not.toContain(">");
    expect(repo.lastUpdatePatch!.title).toContain("Bold title");
  });

  it("updateOwned passes sanitized content when content is provided", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);

    await service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
      content: "<p>Fine</p><iframe src=\"https://evil.com\"></iframe>"
    });

    expect(repo.lastUpdatePatch!.content).not.toContain("iframe");
    expect(repo.lastUpdatePatch!.content).toContain("Fine");
  });

  it("createOwned rejects unknown font families", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);

    await expect(
      service.createOwned("actor-1", {
        title: "Doc",
        content: "<p>Hi</p>",
        language: "en",
        fontFamily: "NotARealFont"
      })
    ).rejects.toMatchObject({
      code: "DOCUMENT_FONT_UNSUPPORTED",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });
});

describe("DocumentService folder invariants", () => {
  it("createFolder sanitizes folder names", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);

    await service.createFolder("actor-1", {
      name: "<b>My Folder</b>",
      parentFolderId: null
    });

    expect(repo.lastInsertFolderPayload).not.toBeNull();
    expect(repo.lastInsertFolderPayload?.name).toBe("My Folder");
  });

  it("updateFolder throws when setting parent to a descendant", async () => {
    const repo = new RecordingRepository();
    repo.parentCheckResult = true;
    repo.folderExists.add("folder-2");
    const service = new DocumentService(repo);

    await expect(
      service.updateFolder("actor-1", "folder-1", { parentFolderId: "folder-2" })
    ).rejects.toMatchObject({
      code: "FOLDER_INVALID_PARENT",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });

  it("createOwned throws when folder does not belong to owner", async () => {
    const repo = new RecordingRepository();
    repo.folderExists.clear();
    const service = new DocumentService(repo);

    await expect(
      service.createOwned("actor-1", {
        title: "Doc",
        content: "<p>x</p>",
        language: "en",
        folderId: "missing-folder"
      })
    ).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
      statusCode: 404
    } satisfies Partial<ApiError>);
  });
});

describe("DocumentService delegation and reads", () => {
  it("listByOwner returns repository rows", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const docs = await service.listByOwner("actor-1");
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("listFolders returns repository folder rows", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const folders = await service.listFolders("actor-1");
    expect(folders).toHaveLength(1);
    expect(folders[0]?.id).toBe("folder-1");
  });

  it("getOwned returns null when the repository finds no document", async () => {
    const service = new DocumentService(new EmptyRepository());
    await expect(service.getOwned("actor-1", "00000000-0000-4000-8000-000000000099")).resolves.toBeNull();
  });

  it("getOwned returns the aggregate when the repository finds a document", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const doc = await service.getOwned("actor-1", "00000000-0000-4000-8000-000000000001");
    expect(doc?.title).toBeDefined();
    expect(doc?.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("getOwnedFolder returns null when missing", async () => {
    const service = new DocumentService(new EmptyRepository());
    await expect(service.getOwnedFolder("actor-1", "folder-x")).resolves.toBeNull();
  });

  it("getOwnedFolder returns the folder when found", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const folder = await service.getOwnedFolder("actor-1", "folder-1");
    expect(folder?.name).toBe("Folder");
  });

  it("deleteOwned returns the repository boolean", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await expect(service.deleteOwned("actor-1", "00000000-0000-4000-8000-000000000001")).resolves.toBe(
      false
    );
  });

  it("deleteFolder returns whether the repository deleted and reparented", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await expect(service.deleteFolder("actor-1", "folder-1")).resolves.toBe(true);
  });
});

describe("DocumentService createFolder", () => {
  it("creates a nested folder when the parent exists", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await service.createFolder("actor-1", { name: "Child", parentFolderId: "folder-1" });
    expect(repo.lastInsertFolderPayload?.name).toBe("Child");
    expect(repo.lastInsertFolderPayload?.parentFolderId).toBe("folder-1");
  });

  it("throws when parentFolderId is set but the owner does not have that folder", async () => {
    const repo = new RecordingRepository();
    repo.folderExists.clear();
    const service = new DocumentService(repo);
    await expect(
      service.createFolder("actor-1", { name: "Orphan", parentFolderId: "folder-1" })
    ).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
      statusCode: 404
    } satisfies Partial<ApiError>);
  });
});

describe("DocumentService updateFolder validation", () => {
  it("throws when the patch is empty", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await expect(service.updateFolder("actor-1", "folder-1", {})).rejects.toMatchObject({
      code: "FOLDER_UPDATE_EMPTY",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });

  it("throws when a folder would become its own parent", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await expect(
      service.updateFolder("actor-1", "folder-1", { parentFolderId: "folder-1" })
    ).rejects.toMatchObject({
      code: "FOLDER_INVALID_PARENT",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });

  it("throws when the new parent folder does not exist", async () => {
    const repo = new RecordingRepository();
    repo.folderExists.clear();
    const service = new DocumentService(repo);
    await expect(
      service.updateFolder("actor-1", "folder-1", { parentFolderId: "folder-2" })
    ).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
      statusCode: 404
    } satisfies Partial<ApiError>);
  });

  it("updates only the folder name when parentFolderId is omitted", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    const out = await service.updateFolder("actor-1", "folder-1", { name: "Renamed" });
    expect(out?.name).toBe("Renamed");
    expect(repo.lastUpdateFolderPatch?.name).toBe("Renamed");
  });

  it("reparents the folder when the new parent exists and is not a descendant", async () => {
    const repo = new RecordingRepository();
    repo.folderExists.add("folder-2");
    const service = new DocumentService(repo);
    const out = await service.updateFolder("actor-1", "folder-1", { parentFolderId: "folder-2" });
    expect(out?.parentFolderId).toBe("folder-2");
  });
});

describe("DocumentService updateOwned folder and font", () => {
  it("rejects updateOwned when patch.folderId points at a folder the owner does not have", async () => {
    const repo = new RecordingRepository();
    repo.folderExists.clear();
    const service = new DocumentService(repo);
    await expect(
      service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
        title: "T",
        folderId: "folder-1"
      })
    ).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
      statusCode: 404
    } satisfies Partial<ApiError>);
  });

  it("passes folderId null through to the repository", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
      folderId: null
    });
    expect(repo.lastUpdatePatch?.folderId).toBeNull();
  });

  it("rejects unsupported fontFamily on update", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await expect(
      service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
        fontFamily: "NotARealFont"
      })
    ).rejects.toMatchObject({
      code: "DOCUMENT_FONT_UNSUPPORTED",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });

  it("includes language in the sanitized patch when only language is updated", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
      language: "ru"
    });
    expect(repo.lastUpdatePatch?.language).toBe("ru");
  });

  it("accepts empty content as an explicit update value", async () => {
    const repo = new RecordingRepository();
    const service = new DocumentService(repo);
    await service.updateOwned("actor-1", "00000000-0000-4000-8000-000000000001", {
      content: ""
    });
    expect(repo.lastUpdatePatch?.content).toBe("");
  });
});
