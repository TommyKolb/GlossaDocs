import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Login } from "@/app/components/Login";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("@/app/hooks/useLanguageCycling", () => ({
  useLanguageCycling: () => [0, 1, 2]
}));

vi.mock("@/app/components/LanguageBadge", () => ({
  LanguageBadge: () => <div data-testid="LanguageBadge" />
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
});
