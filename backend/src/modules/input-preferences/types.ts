import type { KeyboardLayoutOverrides } from "./keyboard-layout-overrides-schema.js";

export type { KeyboardLayoutOverrides };

export interface UserSettings {
  lastUsedLocale: string;
  keyboardVisible: boolean;
  keyboardLayoutOverrides: KeyboardLayoutOverrides;
}

export interface UpdateSettingsDto {
  lastUsedLocale?: string;
  keyboardVisible?: boolean;
  keyboardLayoutOverrides?: KeyboardLayoutOverrides;
}
