import type { QueryResultRow } from "pg";

import { getDbPool, queryDb } from "../../shared/db.js";
import { ApiError } from "../../shared/api-error.js";
import {
  decryptDocumentField,
  encryptDocumentField
} from "../../shared/document-encryption.js";
import type { DocumentLanguage } from "../../shared/document-languages.js";
import type {
  CreateDocumentDto,
  CreateFolderDto,
  DocumentAggregate,
  FolderAggregate,
  UpdateDocumentDto,
  UpdateFolderDto
} from "./types.js";
import type { DocumentRepository } from "./document-repository.js";

interface DocumentRow extends QueryResultRow {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  language: DocumentLanguage;
  folder_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface FolderRow extends QueryResultRow {
  id: string;
  owner_id: string;
  name: string;
  parent_folder_id: string | null;
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
    folderId: row.folder_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toFolderAggregate(row: FolderRow): FolderAggregate {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    parentFolderId: row.parent_folder_id,
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
      `select id, owner_id, title, content, language, folder_id, created_at, updated_at
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
      `select id, owner_id, title, content, language, folder_id, created_at, updated_at
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
      `insert into documents (owner_id, title, content, language, folder_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, now(), now())
       returning id, owner_id, title, content, language, folder_id, created_at, updated_at`,
      [actorSub, title, content, payload.language, payload.folderId ?? null]
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
    const hasFolderPatch = Object.hasOwn(patch, "folderId");
    const folderIdParam = patch.folderId ?? null;
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
         folder_id = case when $6::boolean then $7::uuid else folder_id end,
         updated_at = now()
       where owner_id = $1 and id = $2
       returning id, owner_id, title, content, language, folder_id, created_at, updated_at`,
      [actorSub, id, titleParam, contentParam, patch.language ?? null, hasFolderPatch, folderIdParam]
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

  public async findFoldersByOwner(actorSub: string): Promise<FolderAggregate[]> {
    const rows = await queryDb<FolderRow>(
      this.databaseUrl,
      `select id, owner_id, name, parent_folder_id, created_at, updated_at
       from folders
       where owner_id = $1
       order by updated_at desc`,
      [actorSub]
    );
    return rows.map(toFolderAggregate);
  }

  public async findOwnedFolderById(actorSub: string, id: string): Promise<FolderAggregate | null> {
    const rows = await queryDb<FolderRow>(
      this.databaseUrl,
      `select id, owner_id, name, parent_folder_id, created_at, updated_at
       from folders
       where owner_id = $1 and id = $2`,
      [actorSub, id]
    );
    return rows[0] ? toFolderAggregate(rows[0]) : null;
  }

  public async insertFolder(actorSub: string, payload: CreateFolderDto): Promise<FolderAggregate> {
    const rows = await queryDb<FolderRow>(
      this.databaseUrl,
      `insert into folders (owner_id, name, parent_folder_id, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       returning id, owner_id, name, parent_folder_id, created_at, updated_at`,
      [actorSub, payload.name, payload.parentFolderId]
    );
    const inserted = rows[0];
    if (!inserted) {
      throw new ApiError(500, "FOLDER_INSERT_FAILED", "Folder insert did not return a row");
    }
    return toFolderAggregate(inserted);
  }

  public async updateOwnedFolder(
    actorSub: string,
    id: string,
    patch: UpdateFolderDto
  ): Promise<FolderAggregate | null> {
    const hasParentPatch = Object.hasOwn(patch, "parentFolderId");
    const rows = await queryDb<FolderRow>(
      this.databaseUrl,
      `update folders
       set
         name = coalesce($3, name),
         parent_folder_id = case when $4::boolean then $5::uuid else parent_folder_id end,
         updated_at = now()
       where owner_id = $1 and id = $2
       returning id, owner_id, name, parent_folder_id, created_at, updated_at`,
      [actorSub, id, patch.name ?? null, hasParentPatch, patch.parentFolderId ?? null]
    );
    return rows[0] ? toFolderAggregate(rows[0]) : null;
  }

  public async deleteOwnedFolderAndReparentChildren(actorSub: string, id: string): Promise<boolean> {
    const folderRows = await queryDb<FolderRow>(
      this.databaseUrl,
      `select id, owner_id, name, parent_folder_id, created_at, updated_at
       from folders
       where owner_id = $1 and id = $2`,
      [actorSub, id]
    );
    const folder = folderRows[0];
    if (!folder) {
      return false;
    }

    const pool = getDbPool(this.databaseUrl);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `update documents
         set folder_id = $1
         where owner_id = $2 and folder_id = $3`,
        [folder.parent_folder_id, actorSub, id]
      );
      await client.query(
        `update folders
         set parent_folder_id = $1, updated_at = now()
         where owner_id = $2 and parent_folder_id = $3`,
        [folder.parent_folder_id, actorSub, id]
      );
      await client.query(
        `delete from folders
         where owner_id = $1 and id = $2`,
        [actorSub, id]
      );
      await client.query("commit");
      return true;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  public async folderHasDescendant(
    actorSub: string,
    folderId: string,
    possibleDescendantId: string
  ): Promise<boolean> {
    const rows = await queryDb<{ exists: boolean }>(
      this.databaseUrl,
      `with recursive descendants as (
         select id, parent_folder_id
         from folders
         where owner_id = $1 and parent_folder_id = $2
         union all
         select f.id, f.parent_folder_id
         from folders f
         join descendants d on d.id = f.parent_folder_id
         where f.owner_id = $1
       )
       select exists(
         select 1
         from descendants
         where id = $3
       ) as exists`,
      [actorSub, folderId, possibleDescendantId]
    );
    return rows[0]?.exists ?? false;
  }

  public async ownerHasFolder(actorSub: string, folderId: string): Promise<boolean> {
    const rows = await queryDb<{ exists: boolean }>(
      this.databaseUrl,
      `select exists(
         select 1
         from folders
         where owner_id = $1 and id = $2
       ) as exists`,
      [actorSub, folderId]
    );
    return rows[0]?.exists ?? false;
  }
}
