import type { DocumentLanguage } from "../../shared/document-languages.js";

export type { DocumentLanguage };

export interface DocumentAggregate {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  language: DocumentLanguage;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentDto {
  title: string;
  content: string;
  language: DocumentLanguage;
  folderId?: string | null;
}

export interface UpdateDocumentDto {
  title?: string;
  content?: string;
  language?: DocumentLanguage;
  folderId?: string | null;
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
