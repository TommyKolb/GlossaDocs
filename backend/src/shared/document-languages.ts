export const SUPPORTED_DOCUMENT_LANGUAGES = [
  "en",
  "de",
  "ru",
  "es",
  "fr",
  "it",
  "pt",
  "nl",
  "pl",
  "uk",
  "id",
  "sw",
  "tl"
] as const;

export type DocumentLanguage = (typeof SUPPORTED_DOCUMENT_LANGUAGES)[number];
