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
  "sv",
  "nb",
  "tr",
  "id",
  "sw",
  "tl",
  "ar",
  "zh-Hans",
  "zh-Hant"
] as const;

export type DocumentLanguage = (typeof SUPPORTED_DOCUMENT_LANGUAGES)[number];
