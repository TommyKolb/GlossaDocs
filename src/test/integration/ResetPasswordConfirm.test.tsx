import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ResetPasswordConfirm } from "@/app/components/ResetPasswordConfirm";

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    error: vi.fn()
  }
}));

describe("ResetPasswordConfirm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const validPassword = "ValidPass123!Aa";

  it("submits confirmation and calls onSuccess", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const onSuccess = vi.fn();
    const { toast } = await import("sonner");

    render(
      <ResetPasswordConfirm initialEmail="user@example.com" onBack={() => {}} onSuccess={onSuccess} />
    );
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Password has been reset." })
    } as Response);

    await user.type(screen.getByLabelText(/^Verification code$/i), "123456");
    await user.type(screen.getByLabelText(/^New password$/i), validPassword);
    await user.type(screen.getByLabelText(/^Confirm new password$/i), validPassword);

    await user.click(screen.getByRole("button", { name: /Set new password/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(vi.mocked(toast.message)).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/auth/password-reset/confirm");
    const parsedBody = JSON.parse(String(init?.body)) as {
      email: string;
      code: string;
      newPassword: string;
    };
    expect(parsedBody).toEqual({
      email: "user@example.com",
      code: "123456",
      newPassword: validPassword
    });
  });

  it("shows validation when passwords do not match", async () => {
    render(
      <ResetPasswordConfirm initialEmail="user@example.com" onBack={() => {}} onSuccess={() => {}} />
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Verification code$/i), "123456");
    await user.type(screen.getByLabelText(/^New password$/i), validPassword);
    await user.type(screen.getByLabelText(/^Confirm new password$/i), "OtherPass123!Aa");

    await user.click(screen.getByRole("button", { name: /Set new password/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
  });

  it("prevents submit when password does not satisfy policy", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    render(
      <ResetPasswordConfirm initialEmail="user@example.com" onBack={() => {}} onSuccess={() => {}} />
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Verification code$/i), "123456");
    await user.type(screen.getByLabelText(/^New password$/i), "weak-pass");
    await user.type(screen.getByLabelText(/^Confirm new password$/i), "weak-pass");
    await user.click(screen.getByRole("button", { name: /Set new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 12 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses generic message for API client errors", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const { toast } = await import("sonner");
    render(
      <ResetPasswordConfirm initialEmail="user@example.com" onBack={() => {}} onSuccess={() => {}} />
    );
    const user = userEvent.setup();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "User not found", code: "COGNITO_USER_NOT_FOUND" })
    } as Response);

    await user.type(screen.getByLabelText(/^Verification code$/i), "123456");
    await user.type(screen.getByLabelText(/^New password$/i), validPassword);
    await user.type(screen.getByLabelText(/^Confirm new password$/i), validPassword);
    await user.click(screen.getByRole("button", { name: /Set new password/i }));

    const expected = "Unable to complete password reset. Check your verification code and password, then try again.";
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expected);
  });

  it("invokes onBack when clicking Back", async () => {
    const onBack = vi.fn();
    render(<ResetPasswordConfirm initialEmail="user@example.com" onBack={onBack} onSuccess={() => {}} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Back$/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
