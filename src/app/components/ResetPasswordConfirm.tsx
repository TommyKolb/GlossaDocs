import * as React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ApiClientError } from "../api/client";
import { authApi } from "../api/endpoints";
import { isCognitoCompliantPassword, SIGNUP_PASSWORD_POLICY_HINT } from "../utils/cognito-password-policy";

interface ResetPasswordConfirmProps {
  initialEmail: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function ResetPasswordConfirm({ initialEmail, onBack, onSuccess }: ResetPasswordConfirmProps) {
  const [email, setEmail] = useState(initialEmail.trim());
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = "reset-password-confirm-error";
  const newPasswordPolicyHintId = "reset-new-password-policy";
  const newPasswordDescribedBy = [newPasswordPolicyHintId, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    document.getElementById("confirm-email")?.focus();
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Verification code is required.");
      return;
    }
    if (!isCognitoCompliantPassword(newPassword)) {
      setError(SIGNUP_PASSWORD_POLICY_HINT);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await authApi.confirmPasswordReset({
        email: trimmedEmail,
        code: trimmedCode,
        newPassword
      });
      toast.message(data.message);
      onSuccess();
    } catch (err) {
      const message = err instanceof ApiClientError
        ? "Unable to complete password reset. Check your verification code and password, then try again."
        : err instanceof Error
          ? err.message
          : "Could not reset password";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
            Enter verification code
          </h2>
          <p className="text-xs text-center text-gray-500 mb-6" role="note">
            Use the code from your email, then choose a new password. If your account uses a hosted reset link
            only, use the link in the email instead.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Confirm password reset form">
            <div>
              <label htmlFor="confirm-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                id="confirm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={isSubmitting}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <div>
              <label htmlFor="confirm-code" className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <Input
                id="confirm-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={isSubmitting}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 mb-1">
                New password
              </label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isSubmitting}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={newPasswordDescribedBy}
              />
              <p id={newPasswordPolicyHintId} className="text-xs text-gray-500 mt-1">
                {SIGNUP_PASSWORD_POLICY_HINT}
              </p>
            </div>
            <div>
              <label htmlFor="confirm-repeat-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm new password
              </label>
              <Input
                id="confirm-repeat-password"
                type="password"
                autoComplete="off"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? errorId : undefined}
              />
            </div>

            {error ? (
              <p id={errorId} className="text-sm text-red-600" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? "Saving…" : "Set new password"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
