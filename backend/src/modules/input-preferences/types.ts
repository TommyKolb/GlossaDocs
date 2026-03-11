export interface UserSettings {
  lastUsedLocale: string;
  keyboardVisible: boolean;
}

export interface UpdateSettingsDto {
  lastUsedLocale?: string;
  keyboardVisible?: boolean;
}
