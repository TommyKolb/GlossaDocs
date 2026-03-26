import type { DocumentRepository } from "../../src/modules/documents/document-repository.js";
import type {
  CreateDocumentDto,
  CreateFolderDto,
  DocumentAggregate,
  FolderAggregate,
  UpdateDocumentDto,
  UpdateFolderDto
} from "../../src/modules/documents/types.js";

export class EmptyRepository implements DocumentRepository {
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
export class RecordingRepository implements DocumentRepository {
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
