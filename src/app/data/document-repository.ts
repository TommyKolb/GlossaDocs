import { ApiClientError } from "../api/client";
import { documentsApi } from "../api/endpoints";
import type { Document } from "../models/document";
import { isAuthenticatedMode } from "./session-mode";
import {
  deleteDocument as deleteLocalDocument,
  getAllDocuments as getAllLocalDocuments,
  getDocument as getLocalDocument,
  saveDocument as saveLocalDocument
} from "../utils/db";

const knownRemoteDocumentIds = new Set<string>();

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toAppDocument(apiDocument: {
  id: string;
  title: string;
  content: string;
  language: Document["language"];
  createdAt: string;
  updatedAt: string;
}): Document {
  return {
    id: apiDocument.id,
    title: apiDocument.title,
    content: apiDocument.content,
    language: apiDocument.language,
    createdAt: Date.parse(apiDocument.createdAt),
    updatedAt: Date.parse(apiDocument.updatedAt)
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
    if (error instanceof ApiClientError && error.status === 404) {
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
    language: document.language
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
    if (error instanceof ApiClientError && error.status === 404) {
      knownRemoteDocumentIds.delete(document.id);
      const created = await documentsApi.create(payload);
      knownRemoteDocumentIds.add(created.id);
      return toAppDocument(created);
    }
    throw error;
  }
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
