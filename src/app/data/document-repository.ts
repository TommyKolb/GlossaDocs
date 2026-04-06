import { ApiClientError } from "../api/client";
import { documentsApi, foldersApi } from "../api/endpoints";
import { generateDocumentId, type Document, type Folder } from "../models/document";
import { resolveDocumentFontFamily } from "../utils/language-fonts";
import { isAuthenticatedMode } from "./session-mode";
import {
  deleteDocument as deleteLocalDocument,
  getAllDocuments as getAllLocalDocuments,
  getAllFolders as getAllLocalFolders,
  getDocument as getLocalDocument,
  deleteFolder as deleteLocalFolder,
  saveDocument as saveLocalDocument,
  saveFolder as saveLocalFolder
} from "../utils/db";

const knownRemoteDocumentIds = new Set<string>();

/** Resolves HTTP status from API errors (handles duplicate class identity across bundles in tests). */
function getApiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiClientError) {
    return error.status;
  }
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toAppDocument(apiDocument: {
  id: string;
  title: string;
  content: string;
  language: Document["language"];
  folderId: string | null;
  fontFamily: string | null;
  createdAt: string;
  updatedAt: string;
}): Document {
  return {
    id: apiDocument.id,
    title: apiDocument.title,
    content: apiDocument.content,
    language: apiDocument.language,
    folderId: apiDocument.folderId,
    fontFamily: resolveDocumentFontFamily(apiDocument.language, apiDocument.fontFamily),
    createdAt: Date.parse(apiDocument.createdAt),
    updatedAt: Date.parse(apiDocument.updatedAt)
  };
}

function toAppFolder(apiFolder: {
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}): Folder {
  return {
    id: apiFolder.id,
    name: apiFolder.name,
    parentFolderId: apiFolder.parentFolderId,
    createdAt: Date.parse(apiFolder.createdAt),
    updatedAt: Date.parse(apiFolder.updatedAt)
  };
}

export async function getAllDocuments(): Promise<Document[]> {
  if (!isAuthenticatedMode()) {
    return getAllLocalDocuments();
  }

  const apiDocuments = await documentsApi.list();
  for (const apiDocument of apiDocuments) {
    knownRemoteDocumentIds.add(apiDocument.id);
  }
  return apiDocuments.map(toAppDocument);
}

export async function getDocument(id: string): Promise<Document | null> {
  if (!isAuthenticatedMode()) {
    return getLocalDocument(id);
  }

  if (!isUuid(id)) {
    return null;
  }

  try {
    const apiDocument = await documentsApi.get(id);
    knownRemoteDocumentIds.add(apiDocument.id);
    return toAppDocument(apiDocument);
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveDocument(document: Document): Promise<Document> {
  if (!isAuthenticatedMode()) {
    await saveLocalDocument(document);
    return document;
  }

  const payload = {
    title: document.title,
    content: document.content,
    language: document.language,
    folderId: document.folderId,
    fontFamily: document.fontFamily
  };

  const shouldCreate = !isUuid(document.id) || !knownRemoteDocumentIds.has(document.id);
  if (shouldCreate) {
    const created = await documentsApi.create(payload);
    knownRemoteDocumentIds.add(created.id);
    return toAppDocument(created);
  }

  try {
    const updated = await documentsApi.update(document.id, payload);
    knownRemoteDocumentIds.add(updated.id);
    return toAppDocument(updated);
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      knownRemoteDocumentIds.delete(document.id);
      const created = await documentsApi.create(payload);
      knownRemoteDocumentIds.add(created.id);
      return toAppDocument(created);
    }
    throw error;
  }
}

export async function moveDocumentToFolder(documentId: string, folderId: string | null): Promise<void> {
  if (!isAuthenticatedMode()) {
    const existing = await getLocalDocument(documentId);
    if (!existing) {
      return;
    }
    await saveLocalDocument({
      ...existing,
      folderId,
      updatedAt: Date.now()
    });
    return;
  }

  if (!isUuid(documentId)) {
    return;
  }

  await documentsApi.update(documentId, { folderId });
  knownRemoteDocumentIds.add(documentId);
}

export async function deleteDocument(id: string): Promise<void> {
  if (!isAuthenticatedMode()) {
    await deleteLocalDocument(id);
    return;
  }

  if (!isUuid(id)) {
    return;
  }

  await documentsApi.remove(id);
  knownRemoteDocumentIds.delete(id);
}

export async function getAllFolders(): Promise<Folder[]> {
  if (!isAuthenticatedMode()) {
    return getAllLocalFolders();
  }

  const apiFolders = await foldersApi.list();
  return apiFolders.map(toAppFolder);
}

export async function createFolder(name: string, parentFolderId: string | null): Promise<Folder> {
  if (!isAuthenticatedMode()) {
    const folder: Folder = {
      id: generateDocumentId(),
      name,
      parentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveLocalFolder(folder);
    return folder;
  }

  const created = await foldersApi.create({ name, parentFolderId });
  return toAppFolder(created);
}

export async function updateFolder(folder: Folder): Promise<Folder> {
  if (!isAuthenticatedMode()) {
    const updated: Folder = {
      ...folder,
      updatedAt: Date.now()
    };
    await saveLocalFolder(updated);
    return updated;
  }

  const updated = await foldersApi.update(folder.id, {
    name: folder.name,
    parentFolderId: folder.parentFolderId
  });
  return toAppFolder(updated);
}

export async function deleteFolder(id: string): Promise<void> {
  if (!isAuthenticatedMode()) {
    await deleteLocalFolder(id);
    return;
  }

  if (!isUuid(id)) {
    return;
  }
  await foldersApi.remove(id);
}
