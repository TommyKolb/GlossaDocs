import type { Language } from "../utils/languages";

export interface Document {
  id: string;
  title: string;
  content: string;
  language: Language;
  createdAt: number;
  updatedAt: number;
}

const BASE36_RADIX = 36;

export function generateDocumentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const timestampPart = Date.now().toString(BASE36_RADIX);
  const randomPart = Math.random().toString(BASE36_RADIX).slice(2);
  return `${timestampPart}-${randomPart}`;
}
