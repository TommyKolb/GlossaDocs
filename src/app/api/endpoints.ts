import { apiRequest } from "./client";
import type {
  ApiDocument,
  ApiFolder,
  CreateApiDocumentPayload,
  CreateApiFolderPayload,
  MeResponse,
  UpdateApiDocumentPayload,
  UpdateApiFolderPayload,
  UpdateUserSettingsPayload,
  UserSettings
} from "./contracts";

export interface AuthSessionUser {
  sub: string;
  username: string;
  email?: string;
}

export interface AuthSessionResponse {
  user: AuthSessionUser;
}

interface AuthRegisterResponse {
  message: string;
}

interface AuthPasswordResetResponse {
  message: string;
}

export const meApi = {
  get: () => apiRequest<MeResponse>("/me")
};

export const authApi = {
  login: (payload: { username: string; password: string }) =>
    apiRequest<AuthSessionResponse>("/auth/login", { method: "POST", body: payload }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
  session: () => apiRequest<AuthSessionResponse>("/auth/session"),
  register: (payload: { email: string; password: string }) =>
    apiRequest<AuthRegisterResponse>("/auth/register", { method: "POST", body: payload }),
  requestPasswordReset: (payload: { email: string }) =>
    apiRequest<AuthPasswordResetResponse>("/auth/password-reset", { method: "POST", body: payload })
};

export const settingsApi = {
  get: () => apiRequest<UserSettings>("/settings"),
  update: (payload: UpdateUserSettingsPayload) =>
    apiRequest<UserSettings>("/settings", { method: "PUT", body: payload })
};

export const documentsApi = {
  list: () => apiRequest<ApiDocument[]>("/documents"),
  get: (id: string) => apiRequest<ApiDocument>(`/documents/${id}`),
  create: (payload: CreateApiDocumentPayload) =>
    apiRequest<ApiDocument>("/documents", { method: "POST", body: payload }),
  update: (id: string, payload: UpdateApiDocumentPayload) =>
    apiRequest<ApiDocument>(`/documents/${id}`, { method: "PUT", body: payload }),
  remove: (id: string) => apiRequest<void>(`/documents/${id}`, { method: "DELETE" })
};

export const foldersApi = {
  list: () => apiRequest<ApiFolder[]>("/folders"),
  get: (id: string) => apiRequest<ApiFolder>(`/folders/${id}`),
  create: (payload: CreateApiFolderPayload) =>
    apiRequest<ApiFolder>("/folders", { method: "POST", body: payload }),
  update: (id: string, payload: UpdateApiFolderPayload) =>
    apiRequest<ApiFolder>(`/folders/${id}`, { method: "PUT", body: payload }),
  remove: (id: string) => apiRequest<void>(`/folders/${id}`, { method: "DELETE" })
};
