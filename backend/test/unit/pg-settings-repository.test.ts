import { describe, expect, it } from "vitest";

import { parseKeyboardLayoutOverrides } from "../../src/modules/input-preferences/pg-settings-repository.js";

describe("parseKeyboardLayoutOverrides", () => {
  it("keeps valid language override maps and drops unknown top-level language keys", () => {
    expect(
      parseKeyboardLayoutOverrides({
        en: { q: "x" },
        ru: { й: "k" },
        fr: { a: "b" }
      })
    ).toEqual({
      en: { q: "x" },
      ru: { й: "k" }
    });
  });

  it("drops invalid nested values and keeps remaining valid entries", () => {
    expect(
      parseKeyboardLayoutOverrides({
        en: { q: "", w: "x", long: "12345678901234567" },
        de: "invalid-shape",
        ru: { й: "k" }
      })
    ).toEqual({
      en: { w: "x" },
      ru: { й: "k" }
    });
  });

  it("returns an empty object for non-object values", () => {
    expect(parseKeyboardLayoutOverrides(null)).toEqual({});
    expect(parseKeyboardLayoutOverrides("bad")).toEqual({});
    expect(parseKeyboardLayoutOverrides([])).toEqual({});
  });
});
