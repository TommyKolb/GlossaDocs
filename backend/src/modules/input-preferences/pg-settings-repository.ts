import type { QueryResultRow } from "pg";

import { queryDb } from "../../shared/db.js";
import type { SettingsRepository } from "./settings-repository.js";
import type { UpdateSettingsDto, UserSettings } from "./types.js";

interface SettingsRow extends QueryResultRow {
  owner_id: string;
  last_used_locale: string;
  keyboard_visible: boolean;
  updated_at: Date;
}

function toSettings(row: SettingsRow): UserSettings {
  return {
    lastUsedLocale: row.last_used_locale,
    keyboardVisible: row.keyboard_visible
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
      `select owner_id, last_used_locale, keyboard_visible, updated_at
       from user_settings
       where owner_id = $1`,
      [actorSub]
    );

    if (!rows[0]) {
      return {
        lastUsedLocale: "en-US",
        keyboardVisible: true
      };
    }

    return toSettings(rows[0]);
  }

  public async upsert(actorSub: string, patch: UpdateSettingsDto): Promise<UserSettings> {
    const rows = await queryDb<SettingsRow>(
      this.databaseUrl,
      `insert into user_settings (owner_id, last_used_locale, keyboard_visible, updated_at)
       values (
         $1,
         coalesce($2, 'en-US'),
         coalesce($3, true),
         now()
       )
       on conflict (owner_id)
       do update set
         last_used_locale = coalesce($2, user_settings.last_used_locale),
         keyboard_visible = coalesce($3, user_settings.keyboard_visible),
         updated_at = now()
       returning owner_id, last_used_locale, keyboard_visible, updated_at`,
      [actorSub, patch.lastUsedLocale ?? null, patch.keyboardVisible ?? null]
    );

    const updated = rows[0];
    if (!updated) {
      return {
        lastUsedLocale: "en-US",
        keyboardVisible: true
      };
    }
    return toSettings(updated);
  }
}
