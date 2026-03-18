import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { getApiBaseUrl } from "../api/client";

interface SignUpProps {
  onCancel: () => void;
  onAccountCreated: (email: string) => void;
}

export function SignUp({ onCancel, onAccountCreated }: SignUpProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password })
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Registration failed");
      }

      toast.success("Account created. You can sign in now.");
      onAccountCreated(trimmedEmail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
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
            Create your account
          </h2>
          <p className="text-xs text-center text-gray-500 mb-6" role="note">
            Your email will never be used for spam or shared with anyone else.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create account form">
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
                required
                disabled={isSubmitting}
              />
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
                required
                disabled={isSubmitting}
              />
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
                required
                disabled={isSubmitting}
              />
            </div>

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
                {isSubmitting ? "Creating..." : "Create account"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

