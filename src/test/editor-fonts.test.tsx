import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { EditorToolbar } from "@/app/components/EditorToolbar";
import { LANGUAGES } from "@/app/utils/languages";
import {
  LANGUAGE_FONT_CATALOG,
  getDefaultFontFamilyForLanguage,
  getFontsForLanguage
} from "@/app/utils/language-fonts";

const formattingState = {
  bold: false,
  italic: false,
  underline: false,
  justifyLeft: true,
  justifyCenter: false,
  justifyRight: false
};

describe("language font catalog", () => {
  it("defines default and allowed fonts for every supported language", () => {
    for (const language of LANGUAGES) {
      const entry = LANGUAGE_FONT_CATALOG[language.value];
      expect(entry).toBeDefined();
      expect(entry.defaultFamily.length).toBeGreaterThan(0);
      expect(entry.fonts.length).toBeGreaterThan(0);
      expect(entry.fonts.some((font) => font.family === entry.defaultFamily)).toBe(true);
    }
  });

  it("returns language defaults through helper selectors", () => {
    expect(getDefaultFontFamilyForLanguage("en")).toBeDefined();
    expect(getFontsForLanguage("en").length).toBeGreaterThan(0);
  });
});

describe("EditorToolbar font selector", () => {
  it("renders a font selector for the active language", () => {
    render(
      <EditorToolbar
        language="en"
        fontFamily="Inter"
        onFontFamilyChange={() => {}}
        onLanguageChange={() => {}}
        onSave={() => {}}
        onDownload={() => {}}
        onBack={() => {}}
        onFormat={() => {}}
        formattingState={formattingState}
        isSaving={false}
        title="Doc"
        onTitleChange={() => {}}
        hasUnsavedChanges={false}
        onInsertImage={() => {}}
      />
    );

    expect(screen.getByLabelText("Select document font")).toBeInTheDocument();
  });

  it("exposes english defaults in selector options", async () => {
    const onFontFamilyChange = vi.fn();
    render(
      <EditorToolbar
        language="en"
        fontFamily="Inter"
        onFontFamilyChange={onFontFamilyChange}
        onLanguageChange={() => {}}
        onSave={() => {}}
        onDownload={() => {}}
        onBack={() => {}}
        onFormat={() => {}}
        formattingState={formattingState}
        isSaving={false}
        title="Doc"
        onTitleChange={() => {}}
        hasUnsavedChanges={false}
        onInsertImage={() => {}}
      />
    );

    expect(getFontsForLanguage("en").some((font) => font.family === "Inter")).toBe(true);
  });
});
