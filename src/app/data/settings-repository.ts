import { settingsApi } from "../api/endpoints";
import type { UserSettings } from "../api/contracts";
import type { Language } from "../utils/languages";
import { isAuthenticatedMode, requireAccessToken } from "./session-mode";

const GUEST_SETTINGS_STORAGE_KEY = "glossadocs_guest_settings";

const DEFAULT_SETTINGS: UserSettings = {
  lastUsedLocale: "en-US",
  keyboardVisible: true
};

type LocaleCode = "en-US" | "de-DE" | "ru-RU";

const LANGUAGE_TO_LOCALE: Record<Language, LocaleCode> = {
  en: "en-US",
  de: "de-DE",
  ru: "ru-RU"
};

const LOCALE_PREFIX_TO_LANGUAGE: Array<{ prefix: string; language: Language }> = [
  { prefix: "de", language: "de" },
  { prefix: "ru", language: "ru" },
  { prefix: "en", language: "en" }
];

function readGuestSettings(): UserSettings {
  const raw = localStorage.getItem(GUEST_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      lastUsedLocale: parsed.lastUsedLocale ?? DEFAULT_SETTINGS.lastUsedLocale,
      keyboardVisible: parsed.keyboardVisible ?? DEFAULT_SETTINGS.keyboardVisible
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeGuestSettings(settings: UserSettings): void {
  localStorage.setItem(GUEST_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export async function getUserSettings(): Promise<UserSettings> {
  if (!isAuthenticatedMode()) {
    return readGuestSettings();
  }

  const token = requireAccessToken();
  return settingsApi.get(token);
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  if (!isAuthenticatedMode()) {
    const next = { ...readGuestSettings(), ...patch };
    writeGuestSettings(next);
    return next;
  }

  const token = requireAccessToken();
  return settingsApi.update(token, patch);
}

export function languageToLocale(language: Language): string {
  return LANGUAGE_TO_LOCALE[language];
}

export function localeToLanguage(locale: string): Language {
  const normalized = locale.toLowerCase();
  const mapped = LOCALE_PREFIX_TO_LANGUAGE.find(({ prefix }) => normalized.startsWith(prefix));
  if (mapped) {
    return mapped.language;
  }
  return "en";
}
