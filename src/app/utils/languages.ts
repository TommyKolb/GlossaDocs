export const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺' },
] as const;

export type Language = (typeof LANGUAGES)[number]['value'];
export type LanguageInfo = (typeof LANGUAGES)[number];

/**
 * Get full language information by language code
 */
export function getLanguageInfo(lang: string): LanguageInfo | undefined {
  return LANGUAGES.find(l => l.value === lang);
}

/**
 * Get language name by language code
 */
export function getLanguageName(lang: string): string {
  return getLanguageInfo(lang)?.label || lang;
}

/**
 * Get language flag by language code
 */
export function getLanguageFlag(lang: string): string {
  return getLanguageInfo(lang)?.flag || '';
}

/**
 * Type guard for supported language values
 */
export function isLanguage(value: string): value is Language {
  return LANGUAGES.some((lang) => lang.value === value);
}
