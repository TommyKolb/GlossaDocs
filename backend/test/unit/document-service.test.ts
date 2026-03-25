import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/shared/api-error.js";
import { DocumentService } from "../../src/modules/documents/document-service.js";
import type { DocumentRepository } from "../../src/modules/documents/document-repository.js";
import type {
  CreateDocumentDto,
  DocumentAggregate,
  FolderAggregate,
  CreateFolderDto,
  UpdateFolderDto,
  UpdateDocumentDto
} from "../../src/modules/documents/types.js";

class EmptyRepository implements DocumentRepository {
  public async findByOwner(_actorSub: string): Promise<DocumentAggregate[]> {
    return [];
  }
  public async findOwnedById(_actorSub: string, _id: string): Promise<DocumentAggregate | null> {
    return null;
  }
  public async insert(_actorSub: string, _payload: CreateDocumentDto): Promise<DocumentAggregate> {
    throw new Error("not implemented");
  }
  public async updateOwned(
    _actorSub: string,
    _id: string,
    _patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    return null;
  }
  public async deleteOwned(_actorSub: string, _id: string): Promise<boolean> {
    return false;
  }
  public async findFoldersByOwner(_actorSub: string): Promise<FolderAggregate[]> {
    return [];
  }
  public async findOwnedFolderById(_actorSub: string, _id: string): Promise<FolderAggregate | null> {
    return null;
  }
  public async insertFolder(_actorSub: string, _payload: CreateFolderDto): Promise<FolderAggregate> {
    throw new Error("not implemented");
  }
  public async updateOwnedFolder(
    _actorSub: string,
    _id: string,
    _patch: UpdateFolderDto
  ): Promise<FolderAggregate | null> {
    return null;
  }
  public async deleteOwnedFolderAndReparentChildren(_actorSub: string, _id: string): Promise<boolean> {
    return false;
  }
  public async folderHasDescendant(
    _actorSub: string,
    _folderId: string,
    _possibleDescendantId: string
  ): Promise<boolean> {
    return false;
  }
  public async ownerHasFolder(_actorSub: string, _folderId: string): Promise<boolean> {
    return false;
  }
}

/** Records the last payload passed to insert/updateOwned so tests can assert sanitization. */
class RecordingRepository implements DocumentRepository {
  public lastInsertPayload: CreateDocumentDto | null = null;
  public lastUpdatePatch: UpdateDocumentDto | null = null;
  public lastInsertFolderPayload: CreateFolderDto | null = null;
  public lastUpdateFolderPatch: UpdateFolderDto | null = null;
  public folderExists = new Set<string>(["folder-1"]);
  public parentCheckResult = false;

  private readonly doc: DocumentAggregate = {
    id: "00000000-0000-4000-8000-000000000001",
    ownerId: "actor-1",
    title: "",
    content: "",
    language: "en",
    folderId: null,
    fontFamily: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  private readonly folder: FolderAggregate = {
    id: "folder-1",
    ownerId: "actor-1",
    name: "Folder",
    parentFolderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  public async findByOwner(_actorSub: string): Promise<DocumentAggregate[]> {
    return [this.doc];
  }
  public async findOwnedById(_actorSub: string, id: string): Promise<DocumentAggregate | null> {
    return id === this.doc.id ? this.doc : null;
  }
  public async insert(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate> {
    this.lastInsertPayload = { ...payload };
    return {
      ...this.doc,
      ownerId: actorSub,
      title: payload.title,
      content: payload.content,
      fontFamily: payload.fontFamily ?? null
    };
  }
  public async updateOwned(
    _actorSub: string,
    _id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    this.lastUpdatePatch = { ...patch };
    return { ...this.doc };
  }
  public async deleteOwned(_actorSub: string, _id: string): Promise<boolean> {
    return false;
  }
  public async findFoldersByOwner(_actorSub: string): Promise<FolderAggregate[]> {
    return [this.folder];
  }
  public async findOwnedFolderById(_actorSub: string, id: string): Promise<FolderAggregate | null> {
    return id === this.folder.id ? this.folder : null;
  }
  public async insertFolder(actorSub: string, payload: CreateFolderDto): Promise<FolderAggregate> {
    this.lastInsertFolderPayload = { ...payload };
    return { ...this.folder, ownerId: actorSub, name: payload.name, parentFolderId: payload.parentFolderId };
  }
  public async updateOwnedFolder(
    _actorSub: string,
    id: string,
    patch: UpdateFolderDto
  ): Promise<FolderAggregate | null> {
    if (id !== this.folder.id) {
      return null;
    }
    this.lastUpdateFolderPatch = { ...patch };
    return {
      ...this.folder,
      name: patch.name ?? this.folder.name,
      parentFolderId:
        patch.parentFolderId !== undefined ? patch.parentFolderId : this.folder.parentFolderId
    };
  }
  public async deleteOwnedFolderAndReparentChildren(_actorSub: string, _id: string): Promise<boolean> {
    return true;
  }
  public async folderHasDescendant(
    _actorSub: string,
    _folderId: string,
    _possibleDescendantId: string
  ): Promise<boolean> {
    return this.parentCheckResult;
  }
  public async ownerHasFolder(_actorSub: string, folderId: string): Promise<boolean> {
    return this.folderExists.has(folderId);
  }
}

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
});
