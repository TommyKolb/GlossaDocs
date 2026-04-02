import type { QueryResultRow } from "pg";

import { queryDb } from "../../shared/db.js";
import type { SettingsRepository } from "./settings-repository.js";
import type { KeyboardLayoutOverrides } from "./keyboard-layout-overrides-schema.js";
import type { UpdateSettingsDto, UserSettings } from "./types.js";

interface SettingsRow extends QueryResultRow {
  owner_id: string;
  last_used_locale: string;
  keyboard_visible: boolean;
  keyboard_layout_overrides: unknown;
  updated_at: Date;
}

function parseLanguageOverrides(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized: Record<string, string> = {};
  for (const [output, typedWith] of Object.entries(value as Record<string, unknown>)) {
    if (typeof output !== "string" || output.length === 0 || output.length > 8) {
      continue;
    }
    if (typeof typedWith !== "string" || typedWith.length === 0 || typedWith.length > 16) {
      continue;
    }
    normalized[output] = typedWith;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function parseKeyboardLayoutOverrides(value: unknown): KeyboardLayoutOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  const normalized: KeyboardLayoutOverrides = {};
  for (const language of ["en", "de", "ru"] as const) {
    const perLanguage = parseLanguageOverrides(raw[language]);
    if (perLanguage) {
      normalized[language] = perLanguage;
    }
  }

  return normalized;
}

function toSettings(row: SettingsRow): UserSettings {
  return {
    lastUsedLocale: row.last_used_locale,
    keyboardVisible: row.keyboard_visible,
    keyboardLayoutOverrides: parseKeyboardLayoutOverrides(row.keyboard_layout_overrides)
  };
}

export class PgSettingsRepository implements SettingsRepository {
  private readonly databaseUrl: string;

  public constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
  }

  public async findByOwner(actorSub: string): Promise<UserSettings> {
    const rows = await queryDb<SettingsRow>(
      this.databaseUrl,
      `select owner_id, last_used_locale, keyboard_visible, keyboard_layout_overrides, updated_at
       from user_settings
       where owner_id = $1`,
      [actorSub]
    );

    if (!rows[0]) {
      return {
        lastUsedLocale: "en-US",
        keyboardVisible: true,
        keyboardLayoutOverrides: {}
      };
    }

    return toSettings(rows[0]);
  }

  public async upsert(actorSub: string, patch: UpdateSettingsDto): Promise<UserSettings> {
    const keyboardJson =
      patch.keyboardLayoutOverrides !== undefined ? JSON.stringify(patch.keyboardLayoutOverrides) : null;

    const rows = await queryDb<SettingsRow>(
      this.databaseUrl,
      `insert into user_settings (owner_id, last_used_locale, keyboard_visible, keyboard_layout_overrides, updated_at)
       values (
         $1,
         coalesce($2, 'en-US'),
         coalesce($3, true),
         coalesce($4::jsonb, '{}'::jsonb),
         now()
       )
       on conflict (owner_id)
       do update set
         last_used_locale = coalesce($2, user_settings.last_used_locale),
         keyboard_visible = coalesce($3, user_settings.keyboard_visible),
         keyboard_layout_overrides = coalesce($4::jsonb, user_settings.keyboard_layout_overrides),
         updated_at = now()
       returning owner_id, last_used_locale, keyboard_visible, keyboard_layout_overrides, updated_at`,
      [actorSub, patch.lastUsedLocale ?? null, patch.keyboardVisible ?? null, keyboardJson]
    );

    const updated = rows[0];
    if (!updated) {
      return {
        lastUsedLocale: "en-US",
        keyboardVisible: true,
        keyboardLayoutOverrides: {}
      };
    }
    return toSettings(updated);
  }
}
