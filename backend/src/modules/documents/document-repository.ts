import type { CreateDocumentDto, DocumentAggregate, UpdateDocumentDto } from "./types.js";

export interface DocumentRepository {
  findByOwner(actorSub: string): Promise<DocumentAggregate[]>;
  findOwnedById(actorSub: string, id: string): Promise<DocumentAggregate | null>;
  insert(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate>;
  updateOwned(actorSub: string, id: string, patch: UpdateDocumentDto): Promise<DocumentAggregate | null>;
  deleteOwned(actorSub: string, id: string): Promise<boolean>;
}
