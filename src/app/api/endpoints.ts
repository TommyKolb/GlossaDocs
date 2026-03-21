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
  get: () => apiRequest<MeResponse>("/me")
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
