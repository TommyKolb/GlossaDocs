import { DocumentService } from "../../src/modules/documents/document-service.js";
import type { DocumentRepository } from "../../src/modules/documents/document-repository.js";
import type {
  CreateDocumentDto,
  DocumentAggregate,
  UpdateDocumentDto
} from "../../src/modules/documents/types.js";

class InMemoryDocumentRepository implements DocumentRepository {
  private readonly records = new Map<string, DocumentAggregate>();
  private idCounter = 1;

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

  private buildId(): string {
    // UUID shape keeps route param validation realistic.
    const suffix = String(this.idCounter++).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}`;
  }
}

export function createTestDocumentService(): DocumentService {
  return new DocumentService(new InMemoryDocumentRepository());
}
