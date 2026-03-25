import type { Language } from "../utils/languages";

export interface MeResponse {
  sub: string;
  username: string;
  email?: string;
  scopes: string[];
}

export interface ApiDocument {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  language: Language;
  folderId: string | null;
  fontFamily: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiDocumentPayload {
  title: string;
  content: string;
  language: Language;
  folderId?: string | null;
  fontFamily?: string | null;
}

export interface UpdateApiDocumentPayload {
  title?: string;
  content?: string;
  language?: Language;
  folderId?: string | null;
  fontFamily?: string | null;
}

export interface ApiFolder {
  id: string;
  ownerId: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiFolderPayload {
  name: string;
  parentFolderId: string | null;
}

export interface UpdateApiFolderPayload {
  name?: string;
  parentFolderId?: string | null;
}

export interface UserSettings {
  lastUsedLocale: string;
  keyboardVisible: boolean;
}

export interface UpdateUserSettingsPayload {
  lastUsedLocale?: string;
  keyboardVisible?: boolean;
}
