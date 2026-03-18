import * as React from "react";
import { useEffect, useState } from "react";

import { completeOidcLogin, type User } from "../utils/auth";
import { Button } from "./ui/button";
import { LoadingSpinner } from "./LoadingSpinner";

interface AuthCallbackProps {
  onLoginSuccess: (user: User) => void;
}

export function AuthCallback({ onLoginSuccess }: AuthCallbackProps) {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");

    if (!code) {
      setStatus("error");
      setMessage("Missing authorization code. Please sign in again.");
      return;
    }

    void (async () => {
      try {
        const user = await completeOidcLogin(code);
        onLoginSuccess(user);
        window.history.replaceState(null, "", "/");
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Login failed. Please close this window and try again."
        );
      }
    })();
  }, [onLoginSuccess]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        <LoadingSpinner className="text-blue-600" />
        <span className="sr-only">Completing sign-in…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
            Sign-in problem
          </h1>
          <p className="text-sm text-gray-700 mb-4" role="alert" aria-live="polite">
            {message ?? "We could not complete your sign-in. Please try again."}
          </p>
          <div className="flex justify-center">
            <Button type="button" onClick={() => window.location.assign("/")}>
              Back to sign in
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

