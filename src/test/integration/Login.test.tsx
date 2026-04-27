import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Login } from "@/app/components/Login";
import { LANGUAGES } from "@/app/utils/languages";
import { UI_CONSTANTS } from "@/app/utils/constants";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("@/app/components/LanguageBadge", () => ({
  LanguageBadge: ({ language }: { language: { label: string; value: string } }) => (
    <div data-testid="LanguageBadge" data-language={language.value}>
      {language.label}
    </div>
  )
}));

vi.mock("@/app/utils/auth", () => ({
  loginWithCredentials: vi.fn(),
  continueAsGuest: vi.fn()
}));

describe("Login signup + reset entrypoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders privacy promise about email usage", () => {
    render(<Login onLoginSuccess={() => {}} onCreateAccount={() => {}} onForgotPassword={() => {}} />);

    expect(
      screen.getByText(/Your email will never be used for spam or shared with anyone else\./i)
    ).toBeInTheDocument();
  });

  it("calls onCreateAccount when Create account is clicked", async () => {
    const onCreateAccount = vi.fn();
    render(
      <Login
        onLoginSuccess={() => {}}
        onCreateAccount={onCreateAccount}
        onForgotPassword={() => {}}
      />
    );

    const user = userEvent.setup();
    const createButtons = screen.getAllByTestId("create-account-button");
    await user.click(createButtons[createButtons.length - 1]);

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it("calls onForgotPassword when Forgot password is clicked", async () => {
    const onForgotPassword = vi.fn();
    render(
      <Login
        onLoginSuccess={() => {}}
        onCreateAccount={() => {}}
        onForgotPassword={onForgotPassword}
      />
    );

    const user = userEvent.setup();
    const forgotButtons = screen.getAllByTestId("forgot-password-button");
    await user.click(forgotButtons[forgotButtons.length - 1]);

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it("renders password input for app-hosted sign in", () => {
    render(
      <Login
        onLoginSuccess={() => {}}
        onCreateAccount={() => {}}
        onForgotPassword={() => {}}
      />
    );
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
  });

  it("renders all supported languages in a looping marquee row", () => {
    render(<Login onLoginSuccess={() => {}} onCreateAccount={() => {}} onForgotPassword={() => {}} />);

    const supportedLanguages = screen.getByLabelText("Supported languages");
    const badges = within(supportedLanguages).getAllByTestId("LanguageBadge");

    expect(badges).toHaveLength(LANGUAGES.length * 2);
    const codes = badges.map((badge) => badge.getAttribute("data-language"));
    expect(codes.slice(0, LANGUAGES.length)).toEqual(LANGUAGES.map((l) => l.value));
    expect(codes.slice(LANGUAGES.length)).toEqual(LANGUAGES.map((l) => l.value));
  });

  it("rotates the welcome message on an interval", () => {
    vi.useFakeTimers();
    render(<Login onLoginSuccess={() => {}} onCreateAccount={() => {}} onForgotPassword={() => {}} />);

    act(() => {
      vi.advanceTimersByTime(UI_CONSTANTS.WELCOME_MESSAGE_INTERVAL_MS);
    });

    expect(screen.getByText("Willkommen")).toBeInTheDocument();
  });
});
