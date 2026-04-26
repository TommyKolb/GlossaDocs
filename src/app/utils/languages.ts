export const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇺🇸', welcomeText: 'Welcome', welcomeLabel: 'English' },
  { value: 'de', label: 'German', flag: '🇩🇪', welcomeText: 'Willkommen', welcomeLabel: 'Deutsch' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺', welcomeText: 'Добро пожаловать', welcomeLabel: 'Русский' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸', welcomeText: 'Bienvenido', welcomeLabel: 'Español' },
  { value: 'fr', label: 'French', flag: '🇫🇷', welcomeText: 'Bienvenue', welcomeLabel: 'Français' },
  { value: 'it', label: 'Italian', flag: '🇮🇹', welcomeText: 'Benvenuto', welcomeLabel: 'Italiano' },
  { value: 'pt', label: 'Portuguese', flag: '🇵🇹', welcomeText: 'Bem-vindo', welcomeLabel: 'Português' },
  { value: 'nl', label: 'Dutch', flag: '🇳🇱', welcomeText: 'Welkom', welcomeLabel: 'Nederlands' },
  { value: 'pl', label: 'Polish', flag: '🇵🇱', welcomeText: 'Witamy', welcomeLabel: 'Polski' },
  { value: 'uk', label: 'Ukrainian', flag: '🇺🇦', welcomeText: 'Ласкаво просимо', welcomeLabel: 'Українська' }
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
