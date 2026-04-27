/** Short label for list/toolbar (not regional-flag emoji—those render as two letters on many Windows fonts). */
export const LANGUAGES = [
  { value: 'en', label: 'English', listBadge: 'EN', welcomeText: 'Welcome', welcomeLabel: 'English' },
  { value: 'de', label: 'German', listBadge: 'DE', welcomeText: 'Willkommen', welcomeLabel: 'Deutsch' },
  { value: 'ru', label: 'Russian', listBadge: 'RU', welcomeText: 'Добро пожаловать', welcomeLabel: 'Русский' },
  { value: 'es', label: 'Spanish', listBadge: 'ES', welcomeText: 'Bienvenido', welcomeLabel: 'Español' },
  { value: 'fr', label: 'French', listBadge: 'FR', welcomeText: 'Bienvenue', welcomeLabel: 'Français' },
  { value: 'it', label: 'Italian', listBadge: 'IT', welcomeText: 'Benvenuto', welcomeLabel: 'Italiano' },
  { value: 'pt', label: 'Portuguese', listBadge: 'PT', welcomeText: 'Bem-vindo', welcomeLabel: 'Português' },
  { value: 'nl', label: 'Dutch', listBadge: 'NL', welcomeText: 'Welkom', welcomeLabel: 'Nederlands' },
  { value: 'pl', label: 'Polish', listBadge: 'PL', welcomeText: 'Witamy', welcomeLabel: 'Polski' },
  { value: 'uk', label: 'Ukrainian', listBadge: 'UK', welcomeText: 'Ласкаво просимо', welcomeLabel: 'Українська' },
  { value: 'id', label: 'Indonesian', listBadge: 'ID', welcomeText: 'Selamat datang', welcomeLabel: 'Bahasa Indonesia' },
  { value: 'sw', label: 'Swahili', listBadge: 'SW', welcomeText: 'Karibu', welcomeLabel: 'Kiswahili' },
  { value: 'tl', label: 'Tagalog', listBadge: 'TL', welcomeText: 'Maligayang pagdating', welcomeLabel: 'Filipino' },
  { value: 'ar', label: 'Arabic', listBadge: 'AR', welcomeText: 'أهلاً وسهلاً', welcomeLabel: 'العربية' },
  { value: 'zh-Hans', label: 'Chinese (Simplified)', listBadge: '简', welcomeText: '欢迎', welcomeLabel: '简体中文' },
  { value: 'zh-Hant', label: 'Chinese (Traditional)', listBadge: '繁', welcomeText: '歡迎', welcomeLabel: '繁體中文' }
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
 * Short badge for list/toolbar (language code or script label), by language code.
 */
export function getLanguageListBadge(lang: string): string {
  return getLanguageInfo(lang)?.listBadge || '';
}

/**
 * Type guard for supported language values
 */
export function isLanguage(value: string): value is Language {
  return LANGUAGES.some((lang) => lang.value === value);
}

export type ChineseLanguage = Extract<Language, 'zh-Hans' | 'zh-Hant'>;

export function isChineseLanguage(language: Language): language is ChineseLanguage {
  return language === 'zh-Hans' || language === 'zh-Hant';
}

/** Document languages that use a right-to-left primary script (editor/title `dir`). */
export function isRTLLanguage(language: Language): boolean {
  return language === 'ar';
}
