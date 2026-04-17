import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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

const toolbarProps = {
  language: "en" as const,
  fontFamily: "Inter",
  onFontFamilyChange: () => {},
  onLanguageChange: () => {},
  onSave: () => {},
  onDownload: () => {},
  onBack: () => {},
  onFormat: () => {},
  formattingState,
  isSaving: false,
  title: "Doc",
  onTitleChange: () => {},
  hasUnsavedChanges: false,
  onInsertImage: () => {}
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

  it("falls back to the target language default when candidate is not allowed there", async () => {
    const { resolveDocumentFontFamily } = await import("@/app/utils/language-fonts");
    expect(resolveDocumentFontFamily("de", "Inter")).toBe(getDefaultFontFamilyForLanguage("de"));
    expect(resolveDocumentFontFamily("en", "Noto Sans")).toBe(getDefaultFontFamilyForLanguage("en"));
  });
});

describe("EditorToolbar font selector", () => {
  it("renders an accessible font selector with English catalog options", () => {
    render(<EditorToolbar {...toolbarProps} />);

    expect(screen.getByLabelText("Select document font")).toBeInTheDocument();
    expect(getFontsForLanguage("en").some((font) => font.family === "Inter")).toBe(true);
  });
});

describe("EditorToolbar insert image", () => {
  it("invokes pointer down before click so the parent can save editor selection", () => {
    const onInsertImagePointerDown = vi.fn();
    const onInsertImage = vi.fn();
    render(
      <EditorToolbar
        {...toolbarProps}
        onInsertImagePointerDown={onInsertImagePointerDown}
        onInsertImage={onInsertImage}
      />
    );

    const insertButton = screen.getByRole("button", { name: "Insert image" });
    fireEvent.mouseDown(insertButton);
    fireEvent.click(insertButton);

    expect(onInsertImagePointerDown).toHaveBeenCalledTimes(1);
    expect(onInsertImage).toHaveBeenCalledTimes(1);
  });
});
