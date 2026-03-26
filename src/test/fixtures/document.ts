import type { Document } from "@/app/models/document";

export function minimalDocumentFixture(overrides: Partial<Document> = {}): Document {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Test Doc",
    content: "<p>Hello</p>",
    language: "en",
    folderId: null,
    fontFamily: "serif",
    createdAt: 1,
    updatedAt: 2,
    ...overrides
  };
}
