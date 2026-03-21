import * as React from "react";
import { useState } from "react";

import { Button } from "./ui/button";
export function AuthCallback() {
  const [message] = useState<string | null>(
    "This sign-in callback URL is no longer used. Please return to the app sign-in screen."
  );

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

