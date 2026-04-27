import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "@/app/App";

vi.mock("@/app/components/DocumentList", () => ({
  DocumentList: () => <div />
}));
vi.mock("@/app/components/Editor", () => ({
  Editor: () => <div />
}));
vi.mock("@/app/components/LoadingSpinner", () => ({
  LoadingSpinner: () => <div />
}));
vi.mock("@/app/components/ui/sonner", () => ({
  Toaster: () => <div />
}));

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("@/app/utils/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/utils/auth")>();
  return {
    ...actual,
    getAuthenticatedUserFromBackend: vi.fn(async () => null)
  };
});

describe("App auth flow screens", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Create account switches to app-hosted signup screen (not Keycloak redirect)", async () => {
    render(<App />);
    const user = userEvent.setup();

    const createButton = await screen.findByTestId("create-account-button");
    await user.click(createButton);

    expect(screen.getByRole("heading", { name: /Create your account/i })).toBeInTheDocument();
  });

  it("Forgot password switches to app-hosted reset screen", async () => {
    render(<App />);
    const user = userEvent.setup();

    const forgotButton = await screen.findByTestId("forgot-password-button");
    await user.click(forgotButton);

    expect(screen.getByRole("heading", { name: /Reset your password/i })).toBeInTheDocument();
  });

  it("Forgot password flow can open verification code screen after email is sent", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "ok" })
    } as Response);

    render(<App />);
    const user = userEvent.setup();

    const forgotButton = await screen.findByTestId("forgot-password-button");
    await user.click(forgotButton);

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /Send reset email/i }));

    await screen.findByText(/If an account exists for that email/i);
    await user.click(screen.getByRole("button", { name: /Enter verification code/i }));

    expect(screen.getByRole("heading", { name: /Enter verification code/i })).toBeInTheDocument();
  });
});
