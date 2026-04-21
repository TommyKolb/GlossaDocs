export const SUPPORTED_DOCUMENT_LANGUAGES = ["en", "de", "ru", "es", "fr"] as const;

export type DocumentLanguage = (typeof SUPPORTED_DOCUMENT_LANGUAGES)[number];
