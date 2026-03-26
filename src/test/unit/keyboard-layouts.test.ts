import { describe, expect, it } from "vitest";

import { getKeyboardLayout, getRemappedCharacter } from "@/app/utils/keyboardLayouts";

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
});
