import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Login } from "./Login";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("../hooks/useLanguageCycling", () => ({
  useLanguageCycling: () => [0, 1, 2]
}));

vi.mock("./LanguageBadge", () => ({
  LanguageBadge: () => <div data-testid="LanguageBadge" />
}));

vi.mock("../utils/auth", () => ({
  loginWithCredentials: vi.fn(),
  continueAsGuest: vi.fn()
}));

describe("Login signup + reset entrypoints", () => {
  beforeAll(() => {
    Object.defineProperty(window, "location", {
      value: {
        assign: vi.fn()
      },
      writable: true
    });
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();

    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          arr.fill(7);
          return arr;
        },
        subtle: {
          digest: vi.fn(async () => new Uint8Array(32).fill(9).buffer)
        }
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("renders privacy promise about email usage", () => {
    render(<Login onLoginSuccess={() => {}} />);

    expect(
      screen.getByText(/Your email will never be used for spam or shared with anyone else\./i)
    ).toBeInTheDocument();
  });

  it("navigates to registrationUrl when Create account is clicked", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        registrationUrl: "http://idp.local/register",
        loginUrl: "http://idp.local/login"
      })
    } as any);

    render(<Login onLoginSuccess={() => {}} />);

    const user = userEvent.setup();
    const createButtons = screen.getAllByTestId("create-account-button");
    await user.click(createButtons[createButtons.length - 1]);

    expect(fetch).toHaveBeenCalled();
    const assigned = vi.mocked((window.location as any).assign).mock.calls.at(-1)?.[0] as string;
    expect(assigned).toContain("http://idp.local/register");
    expect(assigned).toContain("code_challenge_method=S256");
    expect(assigned).toContain("code_challenge=");
    expect(sessionStorage.getItem("glossadocs_pkce_code_verifier")).toBeTruthy();
  });

  it("navigates to loginUrl when Forgot password is clicked", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        registrationUrl: "http://idp.local/register",
        loginUrl: "http://idp.local/login"
      })
    } as any);

    render(<Login onLoginSuccess={() => {}} />);

    const user = userEvent.setup();
    const forgotButtons = screen.getAllByTestId("forgot-password-button");
    await user.click(forgotButtons[forgotButtons.length - 1]);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() =>
      expect(vi.mocked((window.location as any).assign).mock.calls.at(-1)?.[0]).toContain(
        "http://idp.local/login"
      )
    );
    const assigned = vi.mocked((window.location as any).assign).mock.calls.at(-1)?.[0] as string;
    expect(assigned).toContain("code_challenge_method=S256");
    expect(assigned).toContain("code_challenge=");
    expect(sessionStorage.getItem("glossadocs_pkce_code_verifier")).toBeTruthy();
  });
});

