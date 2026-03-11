export const SUPPORTED_DOCUMENT_LANGUAGES = ["en", "de", "ru"] as const;

export type DocumentLanguage = (typeof SUPPORTED_DOCUMENT_LANGUAGES)[number];
