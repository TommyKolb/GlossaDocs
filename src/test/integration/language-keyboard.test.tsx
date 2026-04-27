import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LanguageKeyboard } from "@/app/components/LanguageKeyboard";

describe("LanguageKeyboard", () => {
  it("shows which physical key types й when overridden, and the dialog lists the same assignment", async () => {
    const user = userEvent.setup();
    render(
      <LanguageKeyboard
        language="ru"
        isVisible={true}
        onToggleVisibility={() => {}}
        onInsertCharacter={() => {}}
        keyboardLayoutOverrides={{ ru: { й: "k", к: "j" } }}
        onKeyboardLayoutOverridesChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /Insert й using k/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Customize Russian keyboard mappings/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Physical key for letter й")).toHaveValue("k");
  });

  it("shows the Chinese pinyin input instead of fixed mapping customization", async () => {
    const user = userEvent.setup();
    const onCandidateSelect = vi.fn();
    render(
      <LanguageKeyboard
        language="zh-Hans"
        isVisible={true}
        onToggleVisibility={() => {}}
        onInsertCharacter={() => {}}
        keyboardLayoutOverrides={{}}
        onKeyboardLayoutOverridesChange={() => {}}
        pinyinBuffer="nihao"
        pinyinCandidates={[{ pinyin: "nihao", text: "你好", gloss: "hello" }]}
        onPinyinBufferChange={() => {}}
        onPinyinCandidateSelect={onCandidateSelect}
        onPinyinClear={() => {}}
      />
    );

    expect(screen.getByRole("textbox", { name: /Pinyin buffer/i })).toHaveValue("nihao");
    expect(screen.getByText(/not a full Chinese IME/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Customize/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Choose 你好/i }));
    expect(onCandidateSelect).toHaveBeenCalledWith({ pinyin: "nihao", text: "你好", gloss: "hello" });
  });
});
