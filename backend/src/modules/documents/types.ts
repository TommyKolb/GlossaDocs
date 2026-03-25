import type { DocumentLanguage } from "../../shared/document-languages.js";
import type { DocumentFontFamily } from "../../shared/document-fonts.js";

export type { DocumentLanguage };
export type { DocumentFontFamily };

export interface DocumentAggregate {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  language: DocumentLanguage;
  folderId: string | null;
  fontFamily: DocumentFontFamily | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentDto {
  title: string;
  content: string;
  language: DocumentLanguage;
  folderId?: string | null;
  fontFamily?: DocumentFontFamily | null;
}

export interface UpdateDocumentDto {
  title?: string;
  content?: string;
  language?: DocumentLanguage;
  folderId?: string | null;
  fontFamily?: DocumentFontFamily | null;
}

export interface FolderAggregate {
  id: string;
  ownerId: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderDto {
  name: string;
  parentFolderId: string | null;
}

export interface UpdateFolderDto {
  name?: string;
  parentFolderId?: string | null;
}
