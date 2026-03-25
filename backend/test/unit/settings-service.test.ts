import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/shared/api-error.js";
import { SettingsService } from "../../src/modules/input-preferences/settings-service.js";
import type { SettingsRepository } from "../../src/modules/input-preferences/settings-repository.js";

class InertSettingsRepository implements SettingsRepository {
  public async findByOwner() {
    return {
      lastUsedLocale: "en-US",
      keyboardVisible: true
    };
  }

  public async upsert() {
    return {
      lastUsedLocale: "en-US",
      keyboardVisible: true
    };
  }
}

describe("SettingsService invariants", () => {
  it("throws a contract error for empty update payload", async () => {
    const service = new SettingsService(new InertSettingsRepository());

    await expect(service.updateByOwner("actor-1", {})).rejects.toMatchObject({
      code: "SETTINGS_UPDATE_EMPTY",
      statusCode: 400
    } satisfies Partial<ApiError>);
  });
});
