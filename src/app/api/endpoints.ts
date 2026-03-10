import { apiRequest } from "./client";
import type {
  ApiDocument,
  CreateApiDocumentPayload,
  MeResponse,
  UpdateApiDocumentPayload,
  UpdateUserSettingsPayload,
  UserSettings
} from "./contracts";

export const meApi = {
  get: (token: string) => apiRequest<MeResponse>("/me", { token })
};

export const settingsApi = {
  get: (token: string) => apiRequest<UserSettings>("/settings", { token }),
  update: (token: string, payload: UpdateUserSettingsPayload) =>
    apiRequest<UserSettings>("/settings", { method: "PUT", token, body: payload })
};

export const documentsApi = {
  list: (token: string) => apiRequest<ApiDocument[]>("/documents", { token }),
  get: (token: string, id: string) => apiRequest<ApiDocument>(`/documents/${id}`, { token }),
  create: (token: string, payload: CreateApiDocumentPayload) =>
    apiRequest<ApiDocument>("/documents", { method: "POST", token, body: payload }),
  update: (token: string, id: string, payload: UpdateApiDocumentPayload) =>
    apiRequest<ApiDocument>(`/documents/${id}`, { method: "PUT", token, body: payload }),
  remove: (token: string, id: string) =>
    apiRequest<void>(`/documents/${id}`, { method: "DELETE", token })
};
