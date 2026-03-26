import { ApiError } from "../../shared/api-error.js";
import type { SettingsRepository } from "./settings-repository.js";
import type { UpdateSettingsDto, UserSettings } from "./types.js";

export class SettingsService {
  private readonly repository: SettingsRepository;

  public constructor(repository: SettingsRepository) {
    this.repository = repository;
  }

  public async getByOwner(actorSub: string): Promise<UserSettings> {
    return this.repository.findByOwner(actorSub);
  }

  public async updateByOwner(actorSub: string, patch: UpdateSettingsDto): Promise<UserSettings> {
    if (
      patch.lastUsedLocale === undefined &&
      patch.keyboardVisible === undefined &&
      patch.keyboardLayoutOverrides === undefined
    ) {
      throw new ApiError(400, "SETTINGS_UPDATE_EMPTY", "Update payload must include at least one field");
    }

    return this.repository.upsert(actorSub, patch);
  }
}
