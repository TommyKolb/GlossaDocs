import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ForgotPassword } from "@/app/components/ForgotPassword";

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    error: vi.fn()
  }
}));

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a neutral message on success", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { toast } = await import("sonner");
    render(<ForgotPassword onCancel={() => {}} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "ok" })
    } as Response);

    await user.click(screen.getByRole("button", { name: /Send reset email/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/If an account exists for that email, a reset message has been sent\./i)
      ).toBeInTheDocument()
    );
    expect(vi.mocked(toast.message)).toHaveBeenCalled();
  });

  it("shows error when request fails", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { toast } = await import("sonner");
    render(<ForgotPassword onCancel={() => {}} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    fetchMock.mockRejectedValue(new Error("Network down"));

    await user.click(screen.getByRole("button", { name: /Send reset email/i }));
    await waitFor(() => expect(screen.getByText(/Network down/i)).toBeInTheDocument());
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Network down");
  });

  it("calls onProceedToEnterCode after success when the continue button is used", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const onProceedToEnterCode = vi.fn();
    render(<ForgotPassword onCancel={() => {}} onProceedToEnterCode={onProceedToEnterCode} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "ok" })
    } as Response);

    await user.click(screen.getByRole("button", { name: /Send reset email/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/If an account exists for that email, a reset message has been sent\./i)
      ).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /Enter verification code/i }));
    expect(onProceedToEnterCode).toHaveBeenCalledWith("user@example.com");
  });

  it("uses the submitted email even if the field is edited after success", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const onProceedToEnterCode = vi.fn();
    render(<ForgotPassword onCancel={() => {}} onProceedToEnterCode={onProceedToEnterCode} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "ok" })
    } as Response);

    await user.click(screen.getByRole("button", { name: /Send reset email/i }));
    await screen.findByText(/If an account exists for that email/i);

    const emailInput = screen.getByLabelText(/^Email$/i);
    await user.clear(emailInput);
    await user.type(emailInput, "different@example.com");
    await user.click(screen.getByRole("button", { name: /Enter verification code/i }));

    expect(onProceedToEnterCode).toHaveBeenCalledWith("user@example.com");
  });

  it("marks email field invalid and described when submission fails", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    render(<ForgotPassword onCancel={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    fetchMock.mockRejectedValue(new Error("Network down"));
    await user.click(screen.getByRole("button", { name: /Send reset email/i }));
    await screen.findByText(/network down/i);

    const emailInput = screen.getByLabelText(/^Email$/i);
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", "forgot-password-error");
  });
});
