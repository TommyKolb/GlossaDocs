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

const SIMPLIFIED_CHINESE_CATALOG: LanguageFontCatalogEntry = {
  defaultFamily: "Noto Sans SC",
  fonts: [
    { family: "Noto Sans SC", googleFontFamily: "Noto+Sans+SC:wght@400;500;700" },
    { family: "Noto Serif SC", googleFontFamily: "Noto+Serif+SC:wght@400;500;700" },
    { family: "Ma Shan Zheng", googleFontFamily: "Ma+Shan+Zheng" }
  ]
};

const ARABIC_CATALOG: LanguageFontCatalogEntry = {
  defaultFamily: "Noto Sans Arabic",
  fonts: [
    { family: "Noto Sans Arabic", googleFontFamily: "Noto+Sans+Arabic:wght@400;500;700" },
    { family: "Noto Naskh Arabic", googleFontFamily: "Noto+Naskh+Arabic:wght@400;500;700" },
    { family: "Amiri", googleFontFamily: "Amiri:wght@400;700" }
  ]
};

const TRADITIONAL_CHINESE_CATALOG: LanguageFontCatalogEntry = {
  defaultFamily: "Noto Sans TC",
  fonts: [
    { family: "Noto Sans TC", googleFontFamily: "Noto+Sans+TC:wght@400;500;700" },
    { family: "Noto Serif TC", googleFontFamily: "Noto+Serif+TC:wght@400;500;700" },
    { family: "Zhi Mang Xing", googleFontFamily: "Zhi+Mang+Xing" }
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
  fr: SOURCE_SANS_LATIN_CATALOG,
  it: SOURCE_SANS_LATIN_CATALOG,
  pt: SOURCE_SANS_LATIN_CATALOG,
  nl: SOURCE_SANS_LATIN_CATALOG,
  pl: SOURCE_SANS_LATIN_CATALOG,
  uk: {
    defaultFamily: "Noto Sans",
    fonts: [
      { family: "Noto Sans", googleFontFamily: "Noto+Sans:wght@400;500;700" },
      { family: "PT Serif", googleFontFamily: "PT+Serif:wght@400;700" },
      { family: "Roboto Slab", googleFontFamily: "Roboto+Slab:wght@400;600;700" }
    ]
  },
  id: SOURCE_SANS_LATIN_CATALOG,
  sv: SOURCE_SANS_LATIN_CATALOG,
  nb: SOURCE_SANS_LATIN_CATALOG,
  tr: SOURCE_SANS_LATIN_CATALOG,
  sw: SOURCE_SANS_LATIN_CATALOG,
  tl: SOURCE_SANS_LATIN_CATALOG,
  ar: ARABIC_CATALOG,
  "zh-Hans": SIMPLIFIED_CHINESE_CATALOG,
  "zh-Hant": TRADITIONAL_CHINESE_CATALOG
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
