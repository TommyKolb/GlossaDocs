import type { UpdateSettingsDto, UserSettings } from "./types.js";

export interface SettingsRepository {
  findByOwner(actorSub: string): Promise<UserSettings>;
  upsert(actorSub: string, patch: UpdateSettingsDto): Promise<UserSettings>;
}
