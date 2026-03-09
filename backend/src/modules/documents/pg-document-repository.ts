import type { QueryResultRow } from "pg";

import { queryDb } from "../../shared/db.js";
import { ApiError } from "../../shared/api-error.js";
import type { CreateDocumentDto, DocumentAggregate, UpdateDocumentDto } from "./types.js";
import type { DocumentRepository } from "./document-repository.js";

interface DocumentRow extends QueryResultRow {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  language: "en" | "de" | "ru";
  created_at: Date;
  updated_at: Date;
}

function toAggregate(row: DocumentRow): DocumentAggregate {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    content: row.content,
    language: row.language,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export class PgDocumentRepository implements DocumentRepository {
  private readonly databaseUrl: string;

  public constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
  }

  public async findByOwner(actorSub: string): Promise<DocumentAggregate[]> {
    const rows = await queryDb<DocumentRow>(
      this.databaseUrl,
      `select id, owner_id, title, content, language, created_at, updated_at
       from documents
       where owner_id = $1
       order by updated_at desc`,
      [actorSub]
    );

    return rows.map(toAggregate);
  }

  public async findOwnedById(actorSub: string, id: string): Promise<DocumentAggregate | null> {
    const rows = await queryDb<DocumentRow>(
      this.databaseUrl,
      `select id, owner_id, title, content, language, created_at, updated_at
       from documents
       where owner_id = $1 and id = $2`,
      [actorSub, id]
    );

    return rows[0] ? toAggregate(rows[0]) : null;
  }

  public async insert(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate> {
    const rows = await queryDb<DocumentRow>(
      this.databaseUrl,
      `insert into documents (owner_id, title, content, language, created_at, updated_at)
       values ($1, $2, $3, $4, now(), now())
       returning id, owner_id, title, content, language, created_at, updated_at`,
      [actorSub, payload.title, payload.content, payload.language]
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new ApiError(500, "DOCUMENT_INSERT_FAILED", "Document insert did not return a row");
    }
    return toAggregate(inserted);
  }

  public async updateOwned(
    actorSub: string,
    id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    const rows = await queryDb<DocumentRow>(
      this.databaseUrl,
      `update documents
       set
         title = coalesce($3, title),
         content = coalesce($4, content),
         language = coalesce($5, language),
         updated_at = now()
       where owner_id = $1 and id = $2
       returning id, owner_id, title, content, language, created_at, updated_at`,
      [actorSub, id, patch.title ?? null, patch.content ?? null, patch.language ?? null]
    );

    return rows[0] ? toAggregate(rows[0]) : null;
  }

  public async deleteOwned(actorSub: string, id: string): Promise<boolean> {
    const rows = await queryDb<{ id: string }>(
      this.databaseUrl,
      `delete from documents
       where owner_id = $1 and id = $2
       returning id`,
      [actorSub, id]
    );

    return rows.length > 0;
  }
}
