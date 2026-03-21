import * as React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { getApiBaseUrl } from "../api/client";
import {
  isSignupEmailValid,
  isSignupPasswordValid,
  SIGNUP_PASSWORD_MIN_LENGTH
} from "../utils/signup-validation";

interface SignUpProps {
  onCancel: () => void;
  onAccountCreated: (email: string) => void;
}

export function SignUp({ onCancel, onAccountCreated }: SignUpProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const emailOk = isSignupEmailValid(email);
  const passwordOk = isSignupPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = emailOk && passwordOk && passwordsMatch && !isSubmitting;

  const emailHint = useMemo(() => {
    if (!trimmedEmail) return null;
    if (!emailOk) {
      return "Enter a valid email address (for example, you@example.com).";
    }
    return null;
  }, [trimmedEmail, emailOk]);

  const passwordHint = useMemo(() => {
    if (!password) return null;
    if (!passwordOk) {
      return `Password must be at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters.`;
    }
    return null;
  }, [password, passwordOk]);

  const confirmHint = useMemo(() => {
    if (!confirmPassword) return null;
    if (!passwordsMatch) {
      return "Passwords must match.";
    }
    return null;
  }, [confirmPassword, passwordsMatch]);

  const blockingSummary = useMemo(() => {
    if (canSubmit) return null;
    const parts: string[] = [];
    if (!trimmedEmail) {
      parts.push("enter an email");
    } else if (!emailOk) {
      parts.push("fix the email");
    }
    if (!password) {
      parts.push("enter a password");
    } else if (!passwordOk) {
      parts.push(`use a password of at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters`);
    } else if (!passwordsMatch) {
      parts.push("make sure both passwords match");
    }
    if (parts.length === 0) return null;
    const last = parts.pop()!;
    const text = parts.length ? `${parts.join(", ")} and ${last}` : last;
    return `To continue: ${text}.`;
  }, [canSubmit, trimmedEmail, emailOk, password, passwordOk, passwordsMatch]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password })
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };

      if (!response.ok) {
        if (response.status === 409 && data.code === "AUTH_EMAIL_TAKEN") {
          const msg = "An account with this email already exists. Try signing in instead.";
          setServerError(msg);
          toast.error(msg);
          return;
        }
        const msg =
          typeof data.message === "string" && data.message.trim()
            ? data.message
            : "Could not create your account. Please try again.";
        setServerError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Account created. You can sign in now.");
      onAccountCreated(trimmedEmail);
    } catch {
      const msg = "Network error. Check your connection and try again.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
            Create your account
          </h2>
          <p className="text-xs text-center text-gray-500 mb-6" role="note">
            Your email will never be used for spam or shared with anyone else.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create account form" noValidate>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={Boolean(emailHint)}
                aria-describedby={
                  emailHint ? "signup-email-hint signup-email-error" : "signup-email-hint"
                }
              />
              <p id="signup-email-hint" className="text-xs text-gray-500 mt-1" role="note">
                Use a real address you can access (for example, you@example.com).
              </p>
              {emailHint ? (
                <p id="signup-email-error" className="text-sm text-red-600 mt-1" role="alert">
                  {emailHint}
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(passwordHint)}
                aria-describedby={
                  passwordHint ? "signup-password-hint signup-password-error" : "signup-password-hint"
                }
              />
              <p id="signup-password-hint" className="text-xs text-gray-500 mt-1" role="note">
                At least {SIGNUP_PASSWORD_MIN_LENGTH} characters.
              </p>
              {passwordHint ? (
                <p id="signup-password-error" className="text-sm text-red-600 mt-1" role="alert">
                  {passwordHint}
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm password
              </label>
              <Input
                id="signup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(confirmHint)}
                aria-describedby={
                  confirmHint ? "signup-confirm-hint signup-confirm-error" : "signup-confirm-hint"
                }
              />
              <p id="signup-confirm-hint" className="text-xs text-gray-500 mt-1" role="note">
                Type the same password again.
              </p>
              {confirmHint ? (
                <p id="signup-confirm-error" className="text-sm text-red-600 mt-1" role="alert">
                  {confirmHint}
                </p>
              ) : null}
            </div>

            {blockingSummary ? (
              <p className="text-sm text-gray-700" role="status" aria-live="polite">
                {blockingSummary}
              </p>
            ) : null}

            {serverError ? (
              <p className="text-sm text-red-600" role="alert" aria-live="polite">
                {serverError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                aria-disabled={!canSubmit}
              >
                {isSubmitting ? "Creating..." : "Create account"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
