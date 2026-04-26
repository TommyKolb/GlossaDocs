import type { DocumentLanguage } from "./document-languages.js";

export interface DocumentFontDefinition {
  family: string;
  googleFontFamily: string;
}

export interface LanguageFontCatalogEntry {
  defaultFamily: string;
  fonts: readonly DocumentFontDefinition[];
}

const SOURCE_SANS_LATIN_CATALOG: LanguageFontCatalogEntry = {
  defaultFamily: "Source Sans 3",
  fonts: [
    { family: "Source Sans 3", googleFontFamily: "Source+Sans+3:wght@400;500;700" },
    { family: "Nunito Sans", googleFontFamily: "Nunito+Sans:wght@400;600;700" },
    { family: "Crimson Pro", googleFontFamily: "Crimson+Pro:wght@400;500;700" }
  ]
};

export const DOCUMENT_LANGUAGE_FONT_CATALOG: Record<DocumentLanguage, LanguageFontCatalogEntry> = {
  en: {
    defaultFamily: "Inter",
    fonts: [
      { family: "Inter", googleFontFamily: "Inter:wght@400;500;700" },
      { family: "Lora", googleFontFamily: "Lora:wght@400;500;700" },
      { family: "Merriweather", googleFontFamily: "Merriweather:wght@400;700" }
    ]
  },
  de: SOURCE_SANS_LATIN_CATALOG,
  ru: {
    defaultFamily: "Noto Sans",
    fonts: [
      { family: "Noto Sans", googleFontFamily: "Noto+Sans:wght@400;500;700" },
      { family: "PT Serif", googleFontFamily: "PT+Serif:wght@400;700" },
      { family: "Roboto Slab", googleFontFamily: "Roboto+Slab:wght@400;600;700" }
    ]
  },
  es: SOURCE_SANS_LATIN_CATALOG,
  fr: SOURCE_SANS_LATIN_CATALOG
};

export const SUPPORTED_DOCUMENT_FONT_FAMILIES = [
  ...new Set(
    Object.values(DOCUMENT_LANGUAGE_FONT_CATALOG).flatMap((entry) =>
      entry.fonts.map((font) => font.family)
    )
  )
] as const;

export type DocumentFontFamily = (typeof SUPPORTED_DOCUMENT_FONT_FAMILIES)[number];

export function isSupportedDocumentFontFamily(value: string): value is DocumentFontFamily {
  return (SUPPORTED_DOCUMENT_FONT_FAMILIES as readonly string[]).includes(value);
}
