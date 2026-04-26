import { settingsApi } from "../api/endpoints";
import type { UpdateUserSettingsPayload, UserSettings } from "../api/contracts";
import type { Language } from "../utils/languages";
import { normalizeKeyboardLayoutOverrides } from "../utils/keyboardLayouts";
import { isAuthenticatedMode } from "./session-mode";

const GUEST_SETTINGS_STORAGE_KEY = "glossadocs_guest_settings";

const DEFAULT_SETTINGS: UserSettings = {
  lastUsedLocale: "en-US",
  keyboardVisible: true,
  keyboardLayoutOverrides: {}
};

type LocaleCode =
  | "en-US"
  | "de-DE"
  | "ru-RU"
  | "es-ES"
  | "fr-FR"
  | "it-IT"
  | "pt-PT"
  | "nl-NL"
  | "pl-PL"
  | "uk-UA"
  | "id-ID"
  | "vi-VN"
  | "sw-KE"
  | "tl-PH";

const LANGUAGE_TO_LOCALE: Record<Language, LocaleCode> = {
  en: "en-US",
  de: "de-DE",
  ru: "ru-RU",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  pt: "pt-PT",
  nl: "nl-NL",
  pl: "pl-PL",
  uk: "uk-UA",
  id: "id-ID",
  vi: "vi-VN",
  sw: "sw-KE",
  tl: "tl-PH"
};

const LOCALE_PREFIX_TO_LANGUAGE: Array<{ prefix: string; language: Language }> = [
  { prefix: "de", language: "de" },
  { prefix: "ru", language: "ru" },
  { prefix: "es", language: "es" },
  { prefix: "fr", language: "fr" },
  { prefix: "it", language: "it" },
  { prefix: "pt", language: "pt" },
  { prefix: "nl", language: "nl" },
  { prefix: "pl", language: "pl" },
  { prefix: "uk", language: "uk" },
  { prefix: "id", language: "id" },
  { prefix: "vi", language: "vi" },
  { prefix: "sw", language: "sw" },
  { prefix: "tl", language: "tl" },
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
      keyboardVisible: parsed.keyboardVisible ?? DEFAULT_SETTINGS.keyboardVisible,
      keyboardLayoutOverrides: normalizeKeyboardLayoutOverrides(
        parsed.keyboardLayoutOverrides ?? DEFAULT_SETTINGS.keyboardLayoutOverrides
      )
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

  const settings = await settingsApi.get();
  return {
    ...settings,
    keyboardLayoutOverrides: normalizeKeyboardLayoutOverrides(settings.keyboardLayoutOverrides)
  };
}

export async function updateUserSettings(patch: UpdateUserSettingsPayload): Promise<UserSettings> {
  if (!isAuthenticatedMode()) {
    const next = { ...readGuestSettings(), ...patch };
    writeGuestSettings(next);
    return next;
  }

  return settingsApi.update(patch);
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
