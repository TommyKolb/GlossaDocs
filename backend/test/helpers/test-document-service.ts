import { DocumentService } from "../../src/modules/documents/document-service.js";
import type { DocumentRepository } from "../../src/modules/documents/document-repository.js";
import type {
  CreateDocumentDto,
  CreateFolderDto,
  DocumentAggregate,
  FolderAggregate,
  UpdateFolderDto,
  UpdateDocumentDto
} from "../../src/modules/documents/types.js";

class InMemoryDocumentRepository implements DocumentRepository {
  private readonly records = new Map<string, DocumentAggregate>();
  private readonly folders = new Map<string, FolderAggregate>();
  private idCounter = 1;
  private folderIdCounter = 1;

  public async findByOwner(actorSub: string): Promise<DocumentAggregate[]> {
    const docs = [...this.records.values()].filter((doc) => doc.ownerId === actorSub);
    docs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return docs;
  }

  public async findOwnedById(actorSub: string, id: string): Promise<DocumentAggregate | null> {
    const doc = this.records.get(id);
    if (!doc || doc.ownerId !== actorSub) {
      return null;
    }
    return doc;
  }

  public async insert(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate> {
    const now = new Date().toISOString();
    const id = this.buildId();
    const doc: DocumentAggregate = {
      id,
      ownerId: actorSub,
      title: payload.title,
      content: payload.content,
      language: payload.language,
      folderId: payload.folderId ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.records.set(id, doc);
    return doc;
  }

  public async updateOwned(
    actorSub: string,
    id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    const existing = this.records.get(id);
    if (!existing || existing.ownerId !== actorSub) {
      return null;
    }

    const updated: DocumentAggregate = {
      ...existing,
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      language: patch.language ?? existing.language,
      folderId: patch.folderId !== undefined ? patch.folderId : existing.folderId,
      updatedAt: new Date().toISOString()
    };
    this.records.set(id, updated);
    return updated;
  }

  public async deleteOwned(actorSub: string, id: string): Promise<boolean> {
    const existing = this.records.get(id);
    if (!existing || existing.ownerId !== actorSub) {
      return false;
    }
    this.records.delete(id);
    return true;
  }

  public async findFoldersByOwner(actorSub: string): Promise<FolderAggregate[]> {
    const folders = [...this.folders.values()].filter((folder) => folder.ownerId === actorSub);
    folders.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return folders;
  }

  public async findOwnedFolderById(actorSub: string, id: string): Promise<FolderAggregate | null> {
    const folder = this.folders.get(id);
    if (!folder || folder.ownerId !== actorSub) {
      return null;
    }
    return folder;
  }

  public async insertFolder(actorSub: string, payload: CreateFolderDto): Promise<FolderAggregate> {
    const now = new Date().toISOString();
    const id = this.buildFolderId();
    const folder: FolderAggregate = {
      id,
      ownerId: actorSub,
      name: payload.name,
      parentFolderId: payload.parentFolderId,
      createdAt: now,
      updatedAt: now
    };
    this.folders.set(id, folder);
    return folder;
  }

  public async updateOwnedFolder(
    actorSub: string,
    id: string,
    patch: UpdateFolderDto
  ): Promise<FolderAggregate | null> {
    const existing = this.folders.get(id);
    if (!existing || existing.ownerId !== actorSub) {
      return null;
    }
    const updated: FolderAggregate = {
      ...existing,
      name: patch.name ?? existing.name,
      parentFolderId:
        patch.parentFolderId !== undefined ? patch.parentFolderId : existing.parentFolderId,
      updatedAt: new Date().toISOString()
    };
    this.folders.set(id, updated);
    return updated;
  }

  public async deleteOwnedFolderAndReparentChildren(actorSub: string, id: string): Promise<boolean> {
    const existing = this.folders.get(id);
    if (!existing || existing.ownerId !== actorSub) {
      return false;
    }

    const parentFolderId = existing.parentFolderId;
    for (const [docId, doc] of this.records.entries()) {
      if (doc.ownerId === actorSub && doc.folderId === id) {
        this.records.set(docId, {
          ...doc,
          folderId: parentFolderId,
          updatedAt: new Date().toISOString()
        });
      }
    }
    for (const [folderId, folder] of this.folders.entries()) {
      if (folder.ownerId === actorSub && folder.parentFolderId === id) {
        this.folders.set(folderId, {
          ...folder,
          parentFolderId,
          updatedAt: new Date().toISOString()
        });
      }
    }

    this.folders.delete(id);
    return true;
  }

  public async folderHasDescendant(
    actorSub: string,
    folderId: string,
    possibleDescendantId: string
  ): Promise<boolean> {
    const queue: string[] = [folderId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);

      for (const folder of this.folders.values()) {
        if (folder.ownerId !== actorSub || folder.parentFolderId !== current) {
          continue;
        }
        if (folder.id === possibleDescendantId) {
          return true;
        }
        queue.push(folder.id);
      }
    }

    return false;
  }

  public async ownerHasFolder(actorSub: string, folderId: string): Promise<boolean> {
    const folder = this.folders.get(folderId);
    return !!folder && folder.ownerId === actorSub;
  }

  private buildId(): string {
    // UUID shape keeps route param validation realistic.
    const suffix = String(this.idCounter++).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}`;
  }

  private buildFolderId(): string {
    const suffix = String(this.folderIdCounter++).padStart(12, "0");
    return `11111111-1111-4111-8111-${suffix}`;
  }
}

export function createTestDocumentService(): DocumentService {
  return new DocumentService(new InMemoryDocumentRepository());
}
