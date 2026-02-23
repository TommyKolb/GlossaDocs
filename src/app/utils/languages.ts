export type Language = 'en' | 'de' | 'ru';

export interface LanguageInfo {
  value: Language;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺' },
];

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