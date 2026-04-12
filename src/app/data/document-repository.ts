import { ApiClientError } from "../api/client";
import { documentsApi, foldersApi } from "../api/endpoints";
import { generateDocumentId, type Document, type Folder } from "../models/document";
import { resolveDocumentFontFamily } from "../utils/language-fonts";
import {
  forgetRemoteDocumentId,
  hasRemoteDocumentId,
  rememberRemoteDocumentId
} from "./remote-document-cache";
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

type ApiClientLikeError = {
  name: string;
  status: number;
};

function isApiClientLikeError(error: unknown): error is ApiClientLikeError {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    "status" in error &&
    (error as { name: unknown }).name === "ApiClientError" &&
    typeof (error as { status: unknown }).status === "number"
  );
}

/** Resolves HTTP status from API errors while avoiding overly broad duck-typing. */
function getApiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiClientError) {
    return error.status;
  }
  if (isApiClientLikeError(error)) {
    return error.status;
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
    rememberRemoteDocumentId(apiDocument.id);
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
    rememberRemoteDocumentId(apiDocument.id);
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

  const shouldCreate = !isUuid(document.id) || !hasRemoteDocumentId(document.id);
  if (shouldCreate) {
    const created = await documentsApi.create(payload);
    rememberRemoteDocumentId(created.id);
    return toAppDocument(created);
  }

  try {
    const updated = await documentsApi.update(document.id, payload);
    rememberRemoteDocumentId(updated.id);
    return toAppDocument(updated);
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      forgetRemoteDocumentId(document.id);
      const created = await documentsApi.create(payload);
      rememberRemoteDocumentId(created.id);
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
  rememberRemoteDocumentId(documentId);
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
  forgetRemoteDocumentId(id);
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
