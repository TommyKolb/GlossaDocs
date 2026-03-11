import { describe, expect, it } from "vitest";

import { ApiError } from "../src/shared/api-error.js";
import { DocumentService } from "../src/modules/documents/document-service.js";
import type { DocumentRepository } from "../src/modules/documents/document-repository.js";
import type {
  CreateDocumentDto,
  DocumentAggregate,
  UpdateDocumentDto
} from "../src/modules/documents/types.js";

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
