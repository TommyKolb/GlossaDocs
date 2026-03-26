import { describe, expect, it } from "vitest";

import {
  diffKeyboardLayoutAgainstLanguageDefaults,
  getDefaultKeyboardLayout,
  getKeyboardLayout,
  getRemappedCharacter,
  mergeKeyboardLayoutWithOverrides,
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
});

describe("getRemappedCharacter", () => {
  it("returns null for non single-character keys (e.g. Arrow keys)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "ArrowLeft",
        shiftKey: false,
        capsLock: false,
      })
    ).toBeNull();
  });

  it("returns null when the physical key has no mapping for this language", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "`",
        shiftKey: false,
        capsLock: false,
      })
    ).toBeNull();
  });

  it("maps Russian phonetic: Latin j produces Cyrillic й", () => {
    expect(
      getRemappedCharacter({
        language: "ru",
        key: "j",
        shiftKey: false,
        capsLock: false,
      })
    ).toBe("й");
  });

  it("uses shift layer when Shift is held (English q -> Q)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "q",
        shiftKey: true,
        capsLock: false,
      })
    ).toBe("Q");
  });

  it("treats Caps Lock like shift for base letters (q with caps, no shift -> Q)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "q",
        shiftKey: false,
        capsLock: true,
      })
    ).toBe("Q");
  });

  it("cancels shift+caps for base letters (Q when both on)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "q",
        shiftKey: true,
        capsLock: true,
      })
    ).toBe("q");
  });

  it("maps German BracketLeft to ü", () => {
    expect(
      getRemappedCharacter({
        language: "de",
        key: "[",
        shiftKey: false,
        capsLock: false,
      })
    ).toBe("ü");
  });

  it("resolves physical keys case-insensitively (exercises remap table keyed by typedWith.toLowerCase)", () => {
    expect(
      getRemappedCharacter({
        language: "en",
        key: "Q",
        shiftKey: false,
        capsLock: false,
      })
    ).toBe("q");
  });

  it("applies user overrides so on-screen j key and physical j both use the new Cyrillic output", () => {
    const overrides: KeyboardLayoutOverrides = {
      ru: { j: { output: "х" } }
    };
    const layout = getKeyboardLayout("ru", overrides);
    const jKey = layout.flat().find((k) => k.typedWith === "j");
    expect(jKey?.output).toBe("х");

    expect(
      getRemappedCharacter({
        language: "ru",
        key: "j",
        shiftKey: false,
        capsLock: false,
        keyboardLayoutOverrides: overrides
      })
    ).toBe("х");
  });

  it("uses uppercase of overridden output when shift is held if shiftOutput was not set", () => {
    const overrides: KeyboardLayoutOverrides = {
      ru: { j: { output: "х" } }
    };
    expect(
      getRemappedCharacter({
        language: "ru",
        key: "j",
        shiftKey: true,
        capsLock: false,
        keyboardLayoutOverrides: overrides
      })
    ).toBe("Х");
  });

  it("ignores override keys that are not on the built-in layout for that language", () => {
    const overrides: KeyboardLayoutOverrides = {
      en: { "`": { output: "~" } }
    };
    const layout = getKeyboardLayout("en", overrides);
    expect(layout.flat().some((k) => k.typedWith === "`")).toBe(false);
    expect(
      getRemappedCharacter({
        language: "en",
        key: "`",
        shiftKey: false,
        capsLock: false,
        keyboardLayoutOverrides: overrides
      })
    ).toBeNull();
  });

  it("without overrides for a language, layout matches getDefaultKeyboardLayout", () => {
    expect(getKeyboardLayout("ru", {})).toEqual(getDefaultKeyboardLayout("ru"));
    expect(getKeyboardLayout("ru", { en: { q: { output: "X" } } })).toEqual(getDefaultKeyboardLayout("ru"));
  });
});

describe("mergeKeyboardLayoutWithOverrides", () => {
  it("matches case-insensitive typedWith in the override map", () => {
    const base = getDefaultKeyboardLayout("en");
    const merged = mergeKeyboardLayoutWithOverrides(base, { J: { output: "X" } });
    const j = merged.flat().find((k) => k.typedWith === "j");
    expect(j?.output).toBe("X");
  });
});

describe("diffKeyboardLayoutAgainstLanguageDefaults", () => {
  it("returns an empty object when the effective layout matches defaults", () => {
    const layout = getDefaultKeyboardLayout("en");
    expect(diffKeyboardLayoutAgainstLanguageDefaults("en", layout)).toEqual({});
  });

  it("records only keys whose output or shift layer differs from the built-in layout", () => {
    const effective = getKeyboardLayout("ru", { ru: { j: { output: "х" } } });
    expect(diffKeyboardLayoutAgainstLanguageDefaults("ru", effective)).toEqual({
      j: { output: "х" }
    });
  });
});
