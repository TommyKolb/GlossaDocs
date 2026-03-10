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
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiDocumentPayload {
  title: string;
  content: string;
  language: Language;
}

export interface UpdateApiDocumentPayload {
  title?: string;
  content?: string;
  language?: Language;
}

export interface UserSettings {
  lastUsedLocale: string;
  keyboardVisible: boolean;
}

export interface UpdateUserSettingsPayload {
  lastUsedLocale?: string;
  keyboardVisible?: boolean;
}
