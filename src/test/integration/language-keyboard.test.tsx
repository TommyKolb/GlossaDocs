import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguageKeyboard } from "@/app/components/LanguageKeyboard";

describe("LanguageKeyboard", () => {
  it("shows overridden output on the j key and opens the customize dialog with the same value", async () => {
    const user = userEvent.setup();
    render(
      <LanguageKeyboard
        language="ru"
        isVisible={true}
        onToggleVisibility={() => {}}
        onInsertCharacter={() => {}}
        keyboardLayoutOverrides={{ ru: { j: { output: "х" } } }}
        onKeyboardLayoutOverridesChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /Insert х using j/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Customize Russian keyboard mappings/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Output for physical key j")).toHaveValue("х");
  });
});
