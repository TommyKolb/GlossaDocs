import * as React from 'react';
import { useState, useEffect } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { loginWithCredentials, continueAsGuest, type User } from '../utils/auth';
import { LANGUAGES } from '../utils/languages';
import { LanguageBadge } from './LanguageBadge';
import { UI_CONSTANTS } from '../utils/constants';
import { toast } from 'sonner';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
}

export function Login({ onLoginSuccess, onCreateAccount, onForgotPassword }: LoginProps) {
  const showDevAuthNote = import.meta.env.DEV;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentWelcomeIndex, setCurrentWelcomeIndex] = useState(0);
  const [formErrors, setFormErrors] = useState<{ username?: string; password?: string; general?: string }>({});
  const visibleLanguages = Array.from(
    { length: UI_CONSTANTS.WELCOME_LANGUAGE_BADGE_COUNT },
    (_, offset) => LANGUAGES[(currentWelcomeIndex + offset) % LANGUAGES.length]
  );

  // Cycle through welcome messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWelcomeIndex((prev) => (prev + 1) % LANGUAGES.length);
    }, UI_CONSTANTS.WELCOME_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = document.getElementById("username");
    el?.focus();
  }, []);

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const nextErrors: { username?: string; password?: string } = {};

    if (!trimmedUsername) {
      nextErrors.username = 'Email is required.';
    }
    if (!password) {
      nextErrors.password = 'Password is required.';
    }

    if (nextErrors.username || nextErrors.password) {
      setFormErrors(nextErrors);
      toast.error('Please enter your email and password');
      return;
    }

    setFormErrors({});
    setIsLoading(true);
    try {
      const user = await loginWithCredentials({ username: trimmedUsername, password });
      onLoginSuccess(user);
    } catch {
      setFormErrors({
        general: 'Login failed. Please try again.',
      });
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      const user = await continueAsGuest();
      toast.success('Welcome, Guest! Your documents are saved locally.');
      onLoginSuccess(user);
    } catch (error) {
      toast.error('Failed to continue as guest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-md">
        {/* Hero Section */}
        <div className="mb-8 sm:mb-12 text-center relative">
          {/* Background decorative elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-10 left-1/4 text-5xl sm:text-7xl font-serif text-blue-100/40 select-none">
              γλῶσσα
            </div>
            <div className="absolute top-10 -right-10 text-4xl sm:text-5xl font-serif text-indigo-100/30 select-none">
              λόγος
            </div>
          </div>

          {/* Main heading */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
              GlossaDocs
            </h1>
            <div className="text-xs sm:text-sm text-gray-500 italic font-serif">
              γλῶσσα • tongue • language
            </div>
          </div>

          {/* Animated welcome message */}
          <div className="mb-4 sm:mb-6 h-16 sm:h-10" aria-live="polite" aria-atomic="true">
            <p className="text-xl sm:text-2xl font-medium text-gray-700 transition-all duration-500">
              {LANGUAGES[currentWelcomeIndex].welcomeText}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 transition-all duration-500">
              {LANGUAGES[currentWelcomeIndex].welcomeLabel}
            </p>
          </div>

          {/* Language badges with animation */}
          <ul
            className="grid grid-cols-3 items-stretch gap-2 sm:gap-3 mb-6 sm:mb-8 list-none p-0 m-0"
            aria-label="Supported languages"
          >
            {visibleLanguages.map((language, index) => (
              <li key={`language-slot-${index}`} className="min-w-0">
                <LanguageBadge language={language} />
              </li>
            ))}
          </ul>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-4 text-center">
            Sign in to continue
          </h2>
          <p className="text-xs text-center text-gray-500 mb-4">
            Sign in with your GlossaDocs account.
          </p>

          {/* Login Form */}
          <form
            onSubmit={handleLogin}
            className="space-y-4 mb-6"
            aria-label="Login form"
            aria-describedby={formErrors.general ? 'login-error' : undefined}
          >
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                id="username"
                type="email"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFormErrors((prev) => ({ ...prev, username: undefined, general: undefined }));
                }}
                placeholder="you@example.com"
                disabled={isLoading}
                className="w-full"
                autoComplete="username"
                required
                aria-required="true"
                aria-invalid={Boolean(formErrors.username)}
                aria-describedby={formErrors.username ? 'username-error' : undefined}
              />
              {formErrors.username ? (
                <p id="username-error" className="mt-1 text-sm text-red-600" role="alert">
                  {formErrors.username}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                }}
                placeholder="Enter your password"
                disabled={isLoading}
                className="w-full"
                autoComplete="current-password"
                required
                aria-required="true"
                aria-invalid={Boolean(formErrors.password)}
                aria-describedby={formErrors.password ? 'password-error' : undefined}
              />
              {formErrors.password ? (
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {formErrors.password}
                </p>
              ) : null}
            </div>

            {formErrors.general ? (
              <p id="login-error" className="text-sm text-red-600" role="alert" aria-live="polite">
                {formErrors.general}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              aria-label={isLoading ? 'Signing in' : 'Sign in'}
            >
              <LogIn className="size-4" aria-hidden="true" />
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"
            role="group"
            aria-label="Account actions"
          >
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center border-blue-200 text-blue-700 hover:bg-blue-50"
              disabled={isLoading}
              onClick={onCreateAccount}
              aria-label="Create account"
              data-testid="create-account-button"
            >
              Create account
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              disabled={isLoading}
              onClick={onForgotPassword}
              aria-label="Forgot password?"
              data-testid="forgot-password-button"
            >
              Forgot password?
            </Button>
          </div>

          <p className="mb-6 text-xs text-center text-gray-500">
            Your email will never be used for spam or shared with anyone else.
          </p>

          {/* Divider */}
          <div className="relative mb-6" role="separator" aria-label="or">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Guest Login */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full gap-2 border-2 hover:bg-gray-50"
            aria-label="Continue as guest without signing in"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Continue as Guest
          </Button>

          <p className="mt-4 text-xs text-center text-gray-500">
            Guest mode saves documents locally on your device
          </p>
          {showDevAuthNote ? (
            <p className="mt-1 text-xs text-center text-gray-500">
              In local development, create an account from this screen or continue as guest.
            </p>
          ) : null}
        </div>

        <footer className="mt-6 sm:mt-8 max-w-lg mx-auto text-center px-1">
          <p className="text-sm sm:text-base font-semibold text-gray-800">
            Multi-language document editor
          </p>
          <p className="text-xs sm:text-sm text-gray-700 mt-2 leading-snug break-words">
            {LANGUAGES.map((l) => l.label).join(' · ')}
          </p>
          <p className="text-xs sm:text-sm text-gray-600 mt-3 leading-relaxed">
            GlossaDocs is free, ad-free, and independent. Language
            defaults, typography, and keyboard
            helpers may contain mistakes. If you notice something wrong, please email{' '}
            <a
              href={
                'mailto:glossadocs@gmail.com?subject=' +
                encodeURIComponent('GlossaDocs feedback')
              }
              className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              glossadocs@gmail.com
            </a>{' '}
            with a short description of the issue and, if you can, a link or screenshot so it can be
            fixed.
          </p>
        </footer>
      </div>
    </div>
  );
}