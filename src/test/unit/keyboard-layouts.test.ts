import { describe, expect, it } from "vitest";

import {
  diffKeyboardLayoutAgainstLanguageDefaults,
  getDefaultKeyboardLayout,
  getDuplicatePhysicalKeyError,
  getKeyboardLayout,
  getOutputsWithDuplicatePhysicalKeys,
  getRemappedCharacter,
  normalizeKeyboardLayoutOverrides,
  normalizeSinglePhysicalKey,
  type KeyboardLayout,
  type KeyboardLayoutOverrides
} from "@/app/utils/keyboardLayouts";

describe("getKeyboardLayout", () => {
  it("returns three rows for English with expected first-row keys", () => {
    const layout = getKeyboardLayout("en");
    expect(layout).toHaveLength(3);
    expect(layout[0]?.map((k) => k.output).join("")).toBe("qwertyuiop");
  });

  it("includes German-specific letters on the German layout", () => {
    const layout = getKeyboardLayout("de");
    const flat = layout.flat().map((k) => k.output);
    expect(flat).toContain("ü");
    expect(flat).toContain("ß");
  });

  it("maps Russian row keys to Cyrillic outputs and Latin typedWith labels", () => {
    const layout = getKeyboardLayout("ru");
    const jKey = layout.flat().find((k) => k.typedWith === "j");
    expect(jKey?.output).toBe("й");
  });

  it("changes only typedWith when overrides swap two letters’ physical keys (no duplicate keys)", () => {
    const overrides: KeyboardLayoutOverrides = {
      ru: { й: "k", к: "j" }
    };
    const layout = getKeyboardLayout("ru", overrides);
    expect(layout.flat().find((k) => k.output === "й")?.typedWith).toBe("k");
    expect(layout.flat().find((k) => k.output === "к")?.typedWith).toBe("j");
  });
});

describe("getRemappedCharacter", () => {
  it("returns null for non single-character keys (e.g. Arrow keys)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "ArrowLeft",
        shiftKey: false,
        capsLock: false
      })
    ).toBeNull();
  });

  it("returns null when the physical key has no mapping for this language", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "`",
        shiftKey: false,
        capsLock: false
      })
    ).toBeNull();
  });

  it("maps Russian phonetic: Latin j produces Cyrillic й", () => {
    expect(
      getRemappedCharacter({
        language: "ru",
        key: "j",
        shiftKey: false,
        capsLock: false
      })
    ).toBe("й");
  });

  it("uses shift layer when Shift is held (English q -> Q)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "q",
        shiftKey: true,
        capsLock: false
      })
    ).toBe("Q");
  });

  it("treats Caps Lock like shift for base letters (q with caps, no shift -> Q)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "q",
        shiftKey: false,
        capsLock: true
      })
    ).toBe("Q");
  });

  it("cancels shift+caps for base letters (Q when both on)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "q",
        shiftKey: true,
        capsLock: true
      })
    ).toBe("q");
  });

  it("maps German BracketLeft to ü", () => {
    expect(
      getRemappedCharacter({
        language: "de",
        key: "[",
        shiftKey: false,
        capsLock: false
      })
    ).toBe("ü");
  });

  it("resolves physical keys case-insensitively (exercises remap table keyed by typedWith.toLowerCase)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "Q",
        shiftKey: false,
        capsLock: false
      })
    ).toBe("q");
  });

  it("uses output→typedWith overrides: physical k produces й after swapping й and к", () => {
    const overrides: KeyboardLayoutOverrides = {
      ru: { й: "k", к: "j" }
    };
    expect(
      getRemappedCharacter({
        language: "ru",
        key: "k",
        shiftKey: false,
        capsLock: false,
        keyboardLayoutOverrides: overrides
      })
    ).toBe("й");
    expect(
      getRemappedCharacter({
        language: "ru",
        key: "j",
        shiftKey: false,
        capsLock: false,
        keyboardLayoutOverrides: overrides
      })
    ).toBe("к");
  });

  it("uses uppercase of mapped letter when Shift is held (Russian й -> Й)", () => {
    const overrides: KeyboardLayoutOverrides = {
      ru: { й: "k", к: "j" }
    };
    expect(
      getRemappedCharacter({
        language: "ru",
        key: "k",
        shiftKey: true,
        capsLock: false,
        keyboardLayoutOverrides: overrides
      })
    ).toBe("Й");
  });

  it("ignores override entries whose output key is not a letter on the built-in layout", () => {
    const overrides: KeyboardLayoutOverrides = {
      en: { "€": "q" }
    };
    expect(getKeyboardLayout("en", overrides)).toEqual(getDefaultKeyboardLayout("en"));
  });

  it("without overrides for a language, layout matches getDefaultKeyboardLayout", () => {
    expect(getKeyboardLayout("ru", {})).toEqual(getDefaultKeyboardLayout("ru"));
    expect(getKeyboardLayout("ru", { en: { q: "x" } })).toEqual(getDefaultKeyboardLayout("ru"));
  });
});

describe("getDuplicatePhysicalKeyError", () => {
  it("returns null when each physical key maps to at most one letter", () => {
    const layout = getDefaultKeyboardLayout("en");
    expect(getDuplicatePhysicalKeyError(layout)).toBeNull();
  });

  it("returns a message when two letters share the same physical key", () => {
    const base = getDefaultKeyboardLayout("en");
    const broken = base.map((row) =>
      row.map((k) =>
        k.output === "q" || k.output === "a" ? { ...k, typedWith: "z" } : k
      )
    ) as KeyboardLayout;
    expect(getDuplicatePhysicalKeyError(broken)).toContain("same physical key");
  });
});

describe("diffKeyboardLayoutAgainstLanguageDefaults", () => {
  it("returns an empty object when the effective layout matches defaults", () => {
    const layout = getDefaultKeyboardLayout("en");
    expect(diffKeyboardLayoutAgainstLanguageDefaults("en", layout)).toEqual({});
  });

  it("records output→typedWith only where typedWith differs from defaults", () => {
    const effective = getKeyboardLayout("ru", { ru: { й: "k", к: "j" } });
    expect(diffKeyboardLayoutAgainstLanguageDefaults("ru", effective)).toEqual({
      й: "k",
      к: "j"
    });
  });

  it("skips indices where effective output does not match default at the same position", () => {
    const base = getDefaultKeyboardLayout("en");
    const corrupt = base.map((row, ri) =>
      row.map((k, ki) => (ri === 0 && ki === 0 ? { ...k, output: "Z" } : k))
    ) as KeyboardLayout;
    expect(diffKeyboardLayoutAgainstLanguageDefaults("en", corrupt)).toEqual({});
  });
});

describe("normalizeKeyboardLayoutOverrides", () => {
  it("keeps output→string maps and drops legacy physicalKey→object entries", () => {
    expect(
      normalizeKeyboardLayoutOverrides({
        ru: { j: { output: "х" } },
        en: { q: "x" }
      })
    ).toEqual({ en: { q: "x" } });
  });

  it("returns empty for null, undefined, arrays, or non-object roots", () => {
    expect(normalizeKeyboardLayoutOverrides(null)).toEqual({});
    expect(normalizeKeyboardLayoutOverrides(undefined)).toEqual({});
    expect(normalizeKeyboardLayoutOverrides([])).toEqual({});
    expect(normalizeKeyboardLayoutOverrides("x")).toEqual({});
  });

  it("skips unknown language keys and invalid inner shapes", () => {
    expect(normalizeKeyboardLayoutOverrides({ fr: { a: "b" } })).toEqual({});
    expect(normalizeKeyboardLayoutOverrides({ en: "bad" } as unknown)).toEqual({});
    expect(normalizeKeyboardLayoutOverrides({ en: [] } as unknown)).toEqual({});
  });

  it("drops empty string values so language entry is omitted when nothing valid remains", () => {
    expect(normalizeKeyboardLayoutOverrides({ en: { q: "" } })).toEqual({});
  });
});

describe("normalizeSinglePhysicalKey", () => {
  it("returns empty and single-character strings unchanged", () => {
    expect(normalizeSinglePhysicalKey("")).toBe("");
    expect(normalizeSinglePhysicalKey("j")).toBe("j");
  });

  it("truncates pasted multi-character input to the first character", () => {
    expect(normalizeSinglePhysicalKey("ml")).toBe("m");
  });
});

describe("getOutputsWithDuplicatePhysicalKeys", () => {
  it("returns an empty set when every typedWith is unique", () => {
    expect(
      getOutputsWithDuplicatePhysicalKeys([
        { output: "a", typedWith: "a" },
        { output: "b", typedWith: "b" }
      ]).size
    ).toBe(0);
  });

  it("includes every output letter that shares a physical key with another (case-insensitive)", () => {
    const dups = getOutputsWithDuplicatePhysicalKeys([
      { output: "q", typedWith: "j" },
      { output: "a", typedWith: "J" }
    ]);
    expect(dups.has("q")).toBe(true);
    expect(dups.has("a")).toBe(true);
  });
});
