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

/** Records the last payload passed to insert/updateOwned so tests can assert sanitization. */
class RecordingRepository implements DocumentRepository {
  public lastInsertPayload: CreateDocumentDto | null = null;
  public lastUpdatePatch: UpdateDocumentDto | null = null;

  private readonly doc: DocumentAggregate = {
    id: "00000000-0000-4000-8000-000000000001",
    ownerId: "actor-1",
    title: "",
    content: "",
    language: "en",
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
    return { ...this.doc, ownerId: actorSub, title: payload.title, content: payload.content };
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
});
