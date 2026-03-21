import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SignUp } from "@/app/components/SignUp";
import { getApiBaseUrl } from "@/app/api/client";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe("SignUp validation UX", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps Create account disabled until email, password length, and confirm match", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    render(<SignUp onCancel={() => {}} onAccountCreated={() => {}} />);
    const user = userEvent.setup();

    const submitBtn = () => screen.getAllByRole("button", { name: /Create account/i }).at(-1)!;
    expect(submitBtn()).toBeDisabled();

    await user.type(screen.getByLabelText(/^Email$/i), "a@a");
    await user.type(screen.getByLabelText(/^Password$/i), "short");
    await user.type(screen.getByLabelText(/^Confirm password$/i), "short");
    expect(submitBtn()).toBeDisabled();
    expect(screen.getByText(/To continue:/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/^Email$/i));
    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.clear(screen.getByLabelText(/^Password$/i));
    await user.type(screen.getByLabelText(/^Password$/i), "12345678");
    await user.clear(screen.getByLabelText(/^Confirm password$/i));
    await user.type(screen.getByLabelText(/^Confirm password$/i), "87654321");
    expect(submitBtn()).toBeDisabled();

    await user.clear(screen.getByLabelText(/^Confirm password$/i));
    await user.type(screen.getByLabelText(/^Confirm password$/i), "12345678");
    expect(submitBtn()).not.toBeDisabled();

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" })
    } as Response);

    await user.click(submitBtn());
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it("does not toast on blocked submit (button disabled)", async () => {
    const { toast } = await import("sonner");
    render(<SignUp onCancel={() => {}} onAccountCreated={() => {}} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "bad");
    const submit = screen.getAllByRole("button", { name: /Create account/i }).at(-1)!;
    expect(submit).toBeDisabled();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it("shows account-exists message for AUTH_EMAIL_TAKEN", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const onAccountCreated = vi.fn();
    const { toast } = await import("sonner");
    render(<SignUp onCancel={() => {}} onAccountCreated={onAccountCreated} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "12345678");
    await user.type(screen.getByLabelText(/^Confirm password$/i), "12345678");

    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ code: "AUTH_EMAIL_TAKEN", message: "Email is already in use" })
    } as Response);

    await user.click(screen.getByRole("button", { name: /Create account/i }));
    await waitFor(() =>
      expect(screen.getByText(/already exists\. Try signing in instead\./i)).toBeInTheDocument()
    );
    expect(onAccountCreated).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/auth/register`,
      expect.objectContaining({
        method: "POST",
        credentials: "include"
      })
    );
  });

  it("shows generic server error for failed registration", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    render(<SignUp onCancel={() => {}} onAccountCreated={() => {}} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "12345678");
    await user.type(screen.getByLabelText(/^Confirm password$/i), "12345678");

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Unable to create account" })
    } as Response);

    await user.click(screen.getByRole("button", { name: /Create account/i }));
    await waitFor(() => expect(screen.getByText(/Unable to create account/i)).toBeInTheDocument());
  });
});
