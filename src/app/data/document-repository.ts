import { ApiClientError } from "../api/client";
import { documentsApi } from "../api/endpoints";
import type { Document } from "../models/document";
import { isAuthenticatedMode, requireAccessToken } from "./session-mode";
import {
  deleteDocument as deleteLocalDocument,
  getAllDocuments as getAllLocalDocuments,
  getDocument as getLocalDocument,
  saveDocument as saveLocalDocument
} from "../utils/db";

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

  const token = requireAccessToken();
  const apiDocuments = await documentsApi.list(token);
  return apiDocuments.map(toAppDocument);
}

export async function getDocument(id: string): Promise<Document | null> {
  if (!isAuthenticatedMode()) {
    return getLocalDocument(id);
  }

  if (!isUuid(id)) {
    return null;
  }

  const token = requireAccessToken();
  try {
    const apiDocument = await documentsApi.get(token, id);
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

  const token = requireAccessToken();
  const payload = {
    title: document.title,
    content: document.content,
    language: document.language
  };

  if (!isUuid(document.id)) {
    const created = await documentsApi.create(token, payload);
    return toAppDocument(created);
  }

  try {
    const updated = await documentsApi.update(token, document.id, payload);
    return toAppDocument(updated);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      const created = await documentsApi.create(token, payload);
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

  const token = requireAccessToken();
  await documentsApi.remove(token, id);
}
