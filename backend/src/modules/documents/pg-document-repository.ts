import type { QueryResultRow } from "pg";

import { queryDb } from "../../shared/db.js";
import { ApiError } from "../../shared/api-error.js";
import {
  decryptDocumentField,
  encryptDocumentField
} from "../../shared/document-encryption.js";
import type { DocumentLanguage } from "../../shared/document-languages.js";
import type { CreateDocumentDto, DocumentAggregate, UpdateDocumentDto } from "./types.js";
import type { DocumentRepository } from "./document-repository.js";

interface DocumentRow extends QueryResultRow {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  language: DocumentLanguage;
  created_at: Date;
  updated_at: Date;
}

export interface PgDocumentRepositoryOptions {
  databaseUrl: string;
  /** When set, title and content are encrypted on write and decrypted on read. */
  encryptionKey?: Buffer | null;
}

function toAggregate(
  row: DocumentRow,
  encryptionKey: Buffer | null
): DocumentAggregate {
  const title =
    encryptionKey !== null ? decryptDocumentField(row.title, encryptionKey) : row.title;
  const content =
    encryptionKey !== null ? decryptDocumentField(row.content, encryptionKey) : row.content;
  return {
    id: row.id,
    ownerId: row.owner_id,
    title,
    content,
    language: row.language,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export class PgDocumentRepository implements DocumentRepository {
  private readonly databaseUrl: string;
  private readonly encryptionKey: Buffer | null;

  public constructor(options: PgDocumentRepositoryOptions | string) {
    if (typeof options === "string") {
      this.databaseUrl = options;
      this.encryptionKey = null;
    } else {
      this.databaseUrl = options.databaseUrl;
      this.encryptionKey = options.encryptionKey ?? null;
    }
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

    return rows.map((row) => toAggregate(row, this.encryptionKey));
  }

  public async findOwnedById(actorSub: string, id: string): Promise<DocumentAggregate | null> {
    const rows = await queryDb<DocumentRow>(
      this.databaseUrl,
      `select id, owner_id, title, content, language, created_at, updated_at
       from documents
       where owner_id = $1 and id = $2`,
      [actorSub, id]
    );

    return rows[0] ? toAggregate(rows[0], this.encryptionKey) : null;
  }

  public async insert(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate> {
    const title =
      this.encryptionKey !== null
        ? encryptDocumentField(payload.title, this.encryptionKey)
        : payload.title;
    const content =
      this.encryptionKey !== null
        ? encryptDocumentField(payload.content, this.encryptionKey)
        : payload.content;

    const rows = await queryDb<DocumentRow>(
      this.databaseUrl,
      `insert into documents (owner_id, title, content, language, created_at, updated_at)
       values ($1, $2, $3, $4, now(), now())
       returning id, owner_id, title, content, language, created_at, updated_at`,
      [actorSub, title, content, payload.language]
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new ApiError(500, "DOCUMENT_INSERT_FAILED", "Document insert did not return a row");
    }
    return toAggregate(inserted, this.encryptionKey);
  }

  public async updateOwned(
    actorSub: string,
    id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    let titleParam: string | null = patch.title ?? null;
    let contentParam: string | null = patch.content ?? null;
    if (this.encryptionKey !== null) {
      if (patch.title !== undefined) {
        titleParam = encryptDocumentField(patch.title, this.encryptionKey);
      }
      if (patch.content !== undefined) {
        contentParam = encryptDocumentField(patch.content, this.encryptionKey);
      }
    }

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
      [actorSub, id, titleParam, contentParam, patch.language ?? null]
    );

    return rows[0] ? toAggregate(rows[0], this.encryptionKey) : null;
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
