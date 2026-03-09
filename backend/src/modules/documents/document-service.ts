import { ApiError } from "../../shared/api-error.js";
import type { DocumentRepository } from "./document-repository.js";
import type { CreateDocumentDto, DocumentAggregate, UpdateDocumentDto } from "./types.js";

export class DocumentService {
  private readonly repository: DocumentRepository;

  public constructor(repository: DocumentRepository) {
    this.repository = repository;
  }

  public async listByOwner(actorSub: string): Promise<DocumentAggregate[]> {
    return this.repository.findByOwner(actorSub);
  }

  public async getOwned(actorSub: string, id: string): Promise<DocumentAggregate | null> {
    return this.repository.findOwnedById(actorSub, id);
  }

  public async createOwned(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate> {
    return this.repository.insert(actorSub, payload);
  }

  public async updateOwned(
    actorSub: string,
    id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    if (!patch.title && !patch.content && !patch.language) {
      throw new ApiError(400, "DOCUMENT_UPDATE_EMPTY", "Update payload must include at least one field");
    }

    return this.repository.updateOwned(actorSub, id, patch);
  }

  public async deleteOwned(actorSub: string, id: string): Promise<boolean> {
    return this.repository.deleteOwned(actorSub, id);
  }
}
