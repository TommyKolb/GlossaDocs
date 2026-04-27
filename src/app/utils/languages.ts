/** UI grouping for the document language picker (searchable list). */
export type LanguagePickerGroup = 'Latin' | 'Cyrillic' | 'Arabic' | 'Chinese';

/** Short label for list/toolbar (not regional-flag emoji—those render as two letters on many Windows fonts). */
export const LANGUAGES = [
  {
    value: 'en',
    label: 'English',
    listBadge: 'EN',
    welcomeText: 'Welcome',
    welcomeLabel: 'English',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'de',
    label: 'German',
    listBadge: 'DE',
    welcomeText: 'Willkommen',
    welcomeLabel: 'Deutsch',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'ru',
    label: 'Russian',
    listBadge: 'RU',
    welcomeText: 'Добро пожаловать',
    welcomeLabel: 'Русский',
    pickerGroup: 'Cyrillic' as const
  },
  {
    value: 'es',
    label: 'Spanish',
    listBadge: 'ES',
    welcomeText: 'Bienvenido',
    welcomeLabel: 'Español',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'fr',
    label: 'French',
    listBadge: 'FR',
    welcomeText: 'Bienvenue',
    welcomeLabel: 'Français',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'it',
    label: 'Italian',
    listBadge: 'IT',
    welcomeText: 'Benvenuto',
    welcomeLabel: 'Italiano',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'pt',
    label: 'Portuguese',
    listBadge: 'PT',
    welcomeText: 'Bem-vindo',
    welcomeLabel: 'Português',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'nl',
    label: 'Dutch',
    listBadge: 'NL',
    welcomeText: 'Welkom',
    welcomeLabel: 'Nederlands',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'pl',
    label: 'Polish',
    listBadge: 'PL',
    welcomeText: 'Witamy',
    welcomeLabel: 'Polski',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'uk',
    label: 'Ukrainian',
    listBadge: 'UA',
    welcomeText: 'Ласкаво просимо',
    welcomeLabel: 'Українська',
    pickerGroup: 'Cyrillic' as const
  },
  {
    value: 'sv',
    label: 'Swedish',
    listBadge: 'SV',
    welcomeText: 'Välkommen',
    welcomeLabel: 'Svenska',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'nb',
    label: 'Norwegian (Bokmål)',
    listBadge: 'NB',
    welcomeText: 'Velkommen',
    welcomeLabel: 'Norsk',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'tr',
    label: 'Turkish',
    listBadge: 'TR',
    welcomeText: 'Hoş geldiniz',
    welcomeLabel: 'Türkçe',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'id',
    label: 'Indonesian',
    listBadge: 'ID',
    welcomeText: 'Selamat datang',
    welcomeLabel: 'Bahasa Indonesia',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'sw',
    label: 'Swahili',
    listBadge: 'SW',
    welcomeText: 'Karibu',
    welcomeLabel: 'Kiswahili',
    pickerGroup: 'Latin' as const
  },
  // BCP 47: `tl` = Tagalog; `fil` (Filipino) is a related code. We use `tl` for common locale/keyboard interop.
  {
    value: 'tl',
    label: 'Tagalog',
    listBadge: 'TL',
    welcomeText: 'Maligayang pagdating',
    welcomeLabel: 'Filipino',
    pickerGroup: 'Latin' as const
  },
  {
    value: 'ar',
    label: 'Arabic',
    listBadge: 'AR',
    welcomeText: 'أهلاً وسهلاً',
    welcomeLabel: 'العربية',
    pickerGroup: 'Arabic' as const
  },
  {
    value: 'zh-Hans',
    label: 'Chinese (Simplified)',
    listBadge: '简',
    welcomeText: '欢迎',
    welcomeLabel: '简体中文',
    pickerGroup: 'Chinese' as const
  },
  {
    value: 'zh-Hant',
    label: 'Chinese (Traditional)',
    listBadge: '繁',
    welcomeText: '歡迎',
    welcomeLabel: '繁體中文',
    pickerGroup: 'Chinese' as const
  }
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

/**
 * Whether the browser’s native spellcheck should run for this document language.
 * Product rule: on for English only; off elsewhere (see README) so other languages are not swamped with false underlines.
 */
export function isBrowserSpellcheckEnabledForLanguage(language: Language): boolean {
  return language === 'en';
}
