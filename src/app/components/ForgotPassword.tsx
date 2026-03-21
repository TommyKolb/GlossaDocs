import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ApiClientError } from "../api/client";
import { authApi } from "../api/endpoints";

interface ForgotPasswordProps {
  onCancel: () => void;
}

export function ForgotPassword({ onCancel }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.requestPasswordReset({ email: trimmedEmail });
      const msg = "If an account exists for that email, a reset message has been sent.";
      setStatus(msg);
      toast.message(msg);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Password reset request failed";
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
            Reset your password
          </h2>
          <p className="text-xs text-center text-gray-500 mb-6" role="note">
            We’ll only use your email to help you sign in.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Password reset form">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={isSubmitting}
              />
            </div>

            {status ? (
              <p className="text-sm text-green-700" role="status" aria-live="polite">
                {status}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-red-600" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? "Sending..." : "Send reset email"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

