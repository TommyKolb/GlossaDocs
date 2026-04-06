import { ApiError } from "../../shared/api-error.js";
import { isSupportedDocumentFontFamily } from "../../shared/document-fonts.js";
import {
  sanitizeDocumentContent,
  sanitizeDocumentTitle
} from "../../shared/document-sanitizer.js";
import type { DocumentRepository } from "./document-repository.js";
import type {
  CreateDocumentDto,
  CreateFolderDto,
  DocumentAggregate,
  FolderAggregate,
  UpdateDocumentDto,
  UpdateFolderDto
} from "./types.js";

export class DocumentService {
  private readonly repository: DocumentRepository;

  public constructor(repository: DocumentRepository) {
    this.repository = repository;
  }

  private async assertDocumentFolderOwnedIfNonNull(
    actorSub: string,
    folderId: string | null | undefined
  ): Promise<void> {
    if (folderId == null) {
      return;
    }
    const exists = await this.repository.ownerHasFolder(actorSub, folderId);
    if (!exists) {
      throw new ApiError(404, "FOLDER_NOT_FOUND", "Folder not found");
    }
  }

  private assertFontFamilyAllowedIfNonNull(fontFamily: string | null | undefined): void {
    if (fontFamily == null) {
      return;
    }
    if (!isSupportedDocumentFontFamily(fontFamily)) {
      throw new ApiError(400, "DOCUMENT_FONT_UNSUPPORTED", "Unsupported font family");
    }
  }

  public async listByOwner(actorSub: string): Promise<DocumentAggregate[]> {
    return this.repository.findByOwner(actorSub);
  }

  public async listFolders(actorSub: string): Promise<FolderAggregate[]> {
    return this.repository.findFoldersByOwner(actorSub);
  }

  public async getOwned(actorSub: string, id: string): Promise<DocumentAggregate | null> {
    return this.repository.findOwnedById(actorSub, id);
  }

  public async getOwnedFolder(actorSub: string, id: string): Promise<FolderAggregate | null> {
    return this.repository.findOwnedFolderById(actorSub, id);
  }

  public async createOwned(actorSub: string, payload: CreateDocumentDto): Promise<DocumentAggregate> {
    await this.assertDocumentFolderOwnedIfNonNull(actorSub, payload.folderId);
    this.assertFontFamilyAllowedIfNonNull(payload.fontFamily);

    const sanitized: CreateDocumentDto = {
      title: sanitizeDocumentTitle(payload.title),
      content: sanitizeDocumentContent(payload.content),
      language: payload.language,
      folderId: payload.folderId ?? null,
      fontFamily: payload.fontFamily ?? null
    };
    return this.repository.insert(actorSub, sanitized);
  }

  public async updateOwned(
    actorSub: string,
    id: string,
    patch: UpdateDocumentDto
  ): Promise<DocumentAggregate | null> {
    if (
      patch.title === undefined &&
      patch.content === undefined &&
      patch.language === undefined &&
      patch.folderId === undefined &&
      patch.fontFamily === undefined
    ) {
      throw new ApiError(400, "DOCUMENT_UPDATE_EMPTY", "Update payload must include at least one field");
    }

    await this.assertDocumentFolderOwnedIfNonNull(actorSub, patch.folderId);
    this.assertFontFamilyAllowedIfNonNull(patch.fontFamily);

    const sanitized: UpdateDocumentDto = {
      ...(patch.title !== undefined && { title: sanitizeDocumentTitle(patch.title) }),
      ...(patch.content !== undefined && { content: sanitizeDocumentContent(patch.content) }),
      ...(patch.language !== undefined && { language: patch.language }),
      ...(patch.folderId !== undefined && { folderId: patch.folderId }),
      ...(patch.fontFamily !== undefined && { fontFamily: patch.fontFamily })
    };
    return this.repository.updateOwned(actorSub, id, sanitized);
  }

  public async deleteOwned(actorSub: string, id: string): Promise<boolean> {
    return this.repository.deleteOwned(actorSub, id);
  }

  public async createFolder(actorSub: string, payload: CreateFolderDto): Promise<FolderAggregate> {
    if (payload.parentFolderId) {
      const parentExists = await this.repository.ownerHasFolder(actorSub, payload.parentFolderId);
      if (!parentExists) {
        throw new ApiError(404, "FOLDER_NOT_FOUND", "Parent folder not found");
      }
    }

    return this.repository.insertFolder(actorSub, {
      name: sanitizeDocumentTitle(payload.name),
      parentFolderId: payload.parentFolderId
    });
  }

  public async updateFolder(
    actorSub: string,
    id: string,
    patch: UpdateFolderDto
  ): Promise<FolderAggregate | null> {
    if (!patch.name && patch.parentFolderId === undefined) {
      throw new ApiError(400, "FOLDER_UPDATE_EMPTY", "Update payload must include at least one field");
    }

    if (patch.parentFolderId === id) {
      throw new ApiError(400, "FOLDER_INVALID_PARENT", "Folder cannot be its own parent");
    }

    if (patch.parentFolderId) {
      const parentExists = await this.repository.ownerHasFolder(actorSub, patch.parentFolderId);
      if (!parentExists) {
        throw new ApiError(404, "FOLDER_NOT_FOUND", "Parent folder not found");
      }
      const wouldCreateCycle = await this.repository.folderHasDescendant(
        actorSub,
        id,
        patch.parentFolderId
      );
      if (wouldCreateCycle) {
        throw new ApiError(400, "FOLDER_INVALID_PARENT", "Folder parent cannot be a descendant");
      }
    }

    return this.repository.updateOwnedFolder(actorSub, id, {
      ...(patch.name !== undefined && { name: sanitizeDocumentTitle(patch.name) }),
      ...(patch.parentFolderId !== undefined && { parentFolderId: patch.parentFolderId })
    });
  }

  public async deleteFolder(actorSub: string, id: string): Promise<boolean> {
    return this.repository.deleteOwnedFolderAndReparentChildren(actorSub, id);
  }
}
