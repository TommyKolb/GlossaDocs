import { ApiError } from "../../shared/api-error.js";
import {
  sanitizeDocumentContent,
  sanitizeDocumentTitle
} from "../../shared/document-sanitizer.js";
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
    const sanitized: CreateDocumentDto = {
      title: sanitizeDocumentTitle(payload.title),
      content: sanitizeDocumentContent(payload.content),
      language: payload.language
    };
    return this.repository.insert(actorSub, sanitized);
  }

  public async updateOwned(
    actorSub: string,
    id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    if (!patch.title && !patch.content && !patch.language) {
      throw new ApiError(400, "DOCUMENT_UPDATE_EMPTY", "Update payload must include at least one field");
    }

    const sanitized: UpdateDocumentDto = {
      ...(patch.title !== undefined && { title: sanitizeDocumentTitle(patch.title) }),
      ...(patch.content !== undefined && { content: sanitizeDocumentContent(patch.content) }),
      ...(patch.language !== undefined && { language: patch.language })
    };
    return this.repository.updateOwned(actorSub, id, sanitized);
  }

  public async deleteOwned(actorSub: string, id: string): Promise<boolean> {
    return this.repository.deleteOwned(actorSub, id);
  }
}
