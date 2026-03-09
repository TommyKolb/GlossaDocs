export type DocumentLanguage = "en" | "de" | "ru";

export interface DocumentAggregate {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  language: DocumentLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentDto {
  title: string;
  content: string;
  language: DocumentLanguage;
}

export interface UpdateDocumentDto {
  title?: string;
  content?: string;
  language?: DocumentLanguage;
}
