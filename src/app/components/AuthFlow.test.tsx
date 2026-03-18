import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../App";

vi.mock("./DocumentList", () => ({
  DocumentList: () => <div />
}));
vi.mock("./Editor", () => ({
  Editor: () => <div />
}));
vi.mock("./LoadingSpinner", () => ({
  LoadingSpinner: () => <div />
}));
vi.mock("./ui/sonner", () => ({
  Toaster: () => <div />
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("../utils/auth", () => ({
  getAuthenticatedUserFromBackend: vi.fn(async () => null)
}));

describe("App auth flow screens", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  it("Create account switches to app-hosted signup screen (not Keycloak redirect)", async () => {
    render(<App />);
    const user = userEvent.setup();

    const createButtons = await screen.findAllByTestId("create-account-button");
    await user.click(createButtons.at(-1)!);

    expect(screen.getByRole("heading", { name: /Create your account/i })).toBeInTheDocument();
  });

  it("Forgot password switches to app-hosted reset screen", async () => {
    render(<App />);
    const user = userEvent.setup();

    const forgotButtons = await screen.findAllByTestId("forgot-password-button");
    await user.click(forgotButtons.at(-1)!);

    expect(screen.getByRole("heading", { name: /Reset your password/i })).toBeInTheDocument();
  });
});

