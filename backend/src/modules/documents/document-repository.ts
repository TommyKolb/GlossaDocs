import type {
  CreateDocumentDto,
  CreateFolderDto,
  DocumentAggregate,
  FolderAggregate,
  UpdateDocumentDto,
  UpdateFolderDto
} from "./types.js";

export interface DocumentRepository {
  findByOwner(actorSub: string): Promise<DocumentAggregate[]>;
  findOwnedById(actorSub: string, id: string): Promise<DocumentAggregate | null>;
  insert(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate>;
  updateOwned(actorSub: string, id: string, patch: UpdateDocumentDto): Promise<DocumentAggregate | null>;
  deleteOwned(actorSub: string, id: string): Promise<boolean>;
  findFoldersByOwner(actorSub: string): Promise<FolderAggregate[]>;
  findOwnedFolderById(actorSub: string, id: string): Promise<FolderAggregate | null>;
  insertFolder(actorSub: string, payload: CreateFolderDto): Promise<FolderAggregate>;
  updateOwnedFolder(actorSub: string, id: string, patch: UpdateFolderDto): Promise<FolderAggregate | null>;
  deleteOwnedFolderAndReparentChildren(actorSub: string, id: string): Promise<boolean>;
  folderHasDescendant(
    actorSub: string,
    folderId: string,
    possibleDescendantId: string
  ): Promise<boolean>;
  ownerHasFolder(actorSub: string, folderId: string): Promise<boolean>;
}
