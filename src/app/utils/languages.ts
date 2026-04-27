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
  { value: 'uk', label: 'Ukrainian', flag: '🇺🇦', welcomeText: 'Ласкаво просимо', welcomeLabel: 'Українська' },
  { value: 'id', label: 'Indonesian', flag: '🇮🇩', welcomeText: 'Selamat datang', welcomeLabel: 'Bahasa Indonesia' },
  { value: 'sw', label: 'Swahili', flag: '🇰🇪', welcomeText: 'Karibu', welcomeLabel: 'Kiswahili' },
  { value: 'tl', label: 'Tagalog', flag: '🇵🇭', welcomeText: 'Maligayang pagdating', welcomeLabel: 'Filipino' },
  { value: 'ar', label: 'Arabic', flag: '🌐', welcomeText: 'أهلاً وسهلاً', welcomeLabel: 'العربية' },
  { value: 'zh-Hans', label: 'Chinese (Simplified)', flag: '🇨🇳', welcomeText: '欢迎', welcomeLabel: '简体中文' },
  { value: 'zh-Hant', label: 'Chinese (Traditional)', flag: '🇹🇼', welcomeText: '歡迎', welcomeLabel: '繁體中文' }
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

export type ChineseLanguage = Extract<Language, 'zh-Hans' | 'zh-Hant'>;

export function isChineseLanguage(language: Language): language is ChineseLanguage {
  return language === 'zh-Hans' || language === 'zh-Hant';
}

/** Document languages that use a right-to-left primary script (editor/title `dir`). */
export function isRTLLanguage(language: Language): boolean {
  return language === 'ar';
}
