import type { Language } from "./languages";

export interface LanguageFontDefinition {
  family: string;
  googleFontFamily: string;
  fallbackStack: string;
}

export interface LanguageFontCatalogEntry {
  defaultFamily: string;
  fonts: readonly LanguageFontDefinition[];
}

/** Shared Latin extended stack for multiple languages (keeps one edit point; mirror in backend document-fonts). */
const SOURCE_SANS_LATIN_CATALOG: LanguageFontCatalogEntry = {
  defaultFamily: "Source Sans 3",
  fonts: [
    {
      family: "Source Sans 3",
      googleFontFamily: "Source+Sans+3:wght@400;500;700",
      fallbackStack: "sans-serif"
    },
    {
      family: "Nunito Sans",
      googleFontFamily: "Nunito+Sans:wght@400;600;700",
      fallbackStack: "sans-serif"
    },
    {
      family: "Crimson Pro",
      googleFontFamily: "Crimson+Pro:wght@400;500;700",
      fallbackStack: "serif"
    }
  ]
};

export const LANGUAGE_FONT_CATALOG: Record<Language, LanguageFontCatalogEntry> = {
  en: {
    defaultFamily: "Inter",
    fonts: [
      { family: "Inter", googleFontFamily: "Inter:wght@400;500;700", fallbackStack: "sans-serif" },
      { family: "Lora", googleFontFamily: "Lora:wght@400;500;700", fallbackStack: "serif" },
      {
        family: "Merriweather",
        googleFontFamily: "Merriweather:wght@400;700",
        fallbackStack: "serif"
      }
    ]
  },
  de: SOURCE_SANS_LATIN_CATALOG,
  ru: {
    defaultFamily: "Noto Sans",
    fonts: [
      { family: "Noto Sans", googleFontFamily: "Noto+Sans:wght@400;500;700", fallbackStack: "sans-serif" },
      { family: "PT Serif", googleFontFamily: "PT+Serif:wght@400;700", fallbackStack: "serif" },
      {
        family: "Roboto Slab",
        googleFontFamily: "Roboto+Slab:wght@400;600;700",
        fallbackStack: "serif"
      }
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
      { family: "Noto Sans", googleFontFamily: "Noto+Sans:wght@400;500;700", fallbackStack: "sans-serif" },
      { family: "PT Serif", googleFontFamily: "PT+Serif:wght@400;700", fallbackStack: "serif" },
      {
        family: "Roboto Slab",
        googleFontFamily: "Roboto+Slab:wght@400;600;700",
        fallbackStack: "serif"
      }
    ]
  },
  id: SOURCE_SANS_LATIN_CATALOG,
  vi: SOURCE_SANS_LATIN_CATALOG,
  sw: SOURCE_SANS_LATIN_CATALOG,
  tl: SOURCE_SANS_LATIN_CATALOG
};

export const SUPPORTED_FONT_FAMILIES = Array.from(
  new Set(
    Object.values(LANGUAGE_FONT_CATALOG).flatMap((entry) =>
      entry.fonts.map((font) => font.family)
    )
  )
);

export function getFontsForLanguage(language: Language): readonly LanguageFontDefinition[] {
  return LANGUAGE_FONT_CATALOG[language].fonts;
}

export function getDefaultFontFamilyForLanguage(language: Language): string {
  return LANGUAGE_FONT_CATALOG[language].defaultFamily;
}

export function resolveDocumentFontFamily(language: Language, candidate: string | null | undefined): string {
  if (candidate && getFontsForLanguage(language).some((font) => font.family === candidate)) {
    return candidate;
  }
  return getDefaultFontFamilyForLanguage(language);
}

export function getGoogleFontsStylesheetUrl(): string {
  const families = Array.from(
    new Set(
      Object.values(LANGUAGE_FONT_CATALOG).flatMap((entry) =>
        entry.fonts.map((font) => font.googleFontFamily)
      )
    )
  );
  return `https://fonts.googleapis.com/css2?family=${families.join("&family=")}&display=swap`;
}
