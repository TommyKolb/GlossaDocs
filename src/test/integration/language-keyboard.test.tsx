import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
