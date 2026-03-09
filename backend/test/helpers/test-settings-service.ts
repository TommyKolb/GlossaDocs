import { SettingsService } from "../../src/modules/input-preferences/settings-service.js";
import type { SettingsRepository } from "../../src/modules/input-preferences/settings-repository.js";
import type {
  UpdateSettingsDto,
  UserSettings
} from "../../src/modules/input-preferences/types.js";

class InMemorySettingsRepository implements SettingsRepository {
  private readonly records = new Map<string, UserSettings>();

  public async findByOwner(actorSub: string): Promise<UserSettings> {
    return (
      this.records.get(actorSub) ?? {
        lastUsedLocale: "en-US",
        keyboardVisible: true
      }
    );
  }

  public async upsert(actorSub: string, patch: UpdateSettingsDto): Promise<UserSettings> {
    const current = await this.findByOwner(actorSub);
    const next: UserSettings = {
      lastUsedLocale: patch.lastUsedLocale ?? current.lastUsedLocale,
      keyboardVisible: patch.keyboardVisible ?? current.keyboardVisible
    };
    this.records.set(actorSub, next);
    return next;
  }
}

export function createTestSettingsService(): SettingsService {
  return new SettingsService(new InMemorySettingsRepository());
}
