import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { loginWithCredentials, continueAsGuest, type User } from '../utils/auth';
import { LANGUAGES } from '../utils/languages';
import { useLanguageCycling } from '../hooks/useLanguageCycling';
import { LanguageBadge } from './LanguageBadge';
import { GreekDecoration } from './GreekDecoration';
import { UI_CONSTANTS } from '../utils/constants';
import { toast } from 'sonner';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

// Multilingual welcome messages
const WELCOME_MESSAGES = [
  { text: 'Welcome', lang: 'English' },
  { text: 'Willkommen', lang: 'Deutsch' },
  { text: 'Добро пожаловать', lang: 'Русский' },
  { text: 'Bienvenue', lang: 'Français' },
  { text: 'Bienvenido', lang: 'Español' },
  { text: 'Benvenuto', lang: 'Italiano' },
];

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentWelcomeIndex, setCurrentWelcomeIndex] = useState(0);

  const visibleLanguages = useLanguageCycling(LANGUAGES.length);

  // Cycle through welcome messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWelcomeIndex((prev) => (prev + 1) % WELCOME_MESSAGES.length);
    }, UI_CONSTANTS.WELCOME_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithCredentials({ username, password });
      toast.success(`Welcome back, ${user.username}!`);
      onLoginSuccess(user);
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
      console.error('Login error:', error);
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
      console.error('Guest login error:', error);
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
              {WELCOME_MESSAGES[currentWelcomeIndex].text}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 transition-all duration-500">
              {WELCOME_MESSAGES[currentWelcomeIndex].lang}
            </p>
          </div>

          {/* Language badges with animation */}
          <div className="h-12 flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8" role="list" aria-label="Supported languages">
            <AnimatePresence mode="sync">
              {visibleLanguages.map((index) => (
                <LanguageBadge key={LANGUAGES[index].value} language={LANGUAGES[index]} />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 text-center">
            Sign in to continue
          </h2>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4 mb-6" aria-label="Login form">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                className="w-full"
                autoComplete="username"
                required
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className="w-full"
                autoComplete="current-password"
                required
                aria-required="true"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              aria-label={isLoading ? 'Signing in' : 'Sign in to your account'}
            >
              <LogIn className="size-4" aria-hidden="true" />
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

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

          <p className="mt-4 text-xs text-center text-gray-500" role="note">
            Guest mode saves documents locally on your device
          </p>
        </div>

        {/* Footer note */}
        <div className="mt-4 sm:mt-6 text-center text-sm text-gray-600">
          <p>Multi-language document editor</p>
          <p className="text-xs text-gray-500 mt-1">
            Supporting English, Deutsch, and Русский
          </p>
        </div>
      </div>
    </div>
  );
}