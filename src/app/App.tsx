import { useState, useEffect, useLayoutEffect } from 'react';
import { DocumentList } from './components/DocumentList';
import { Editor } from './components/Editor';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPasswordConfirm } from './components/ResetPasswordConfirm';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Toaster } from './components/ui/sonner';
import { getAuthenticatedUserFromBackend, setSessionOverride, type User } from './utils/auth';
import { UI_CONSTANTS } from './utils/constants';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null | undefined>(undefined);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot' | 'reset-confirm'>('login');
  const [passwordResetEmail, setPasswordResetEmail] = useState('');

  // Check for existing user session on mount (never leave loading if hydrate throws or hangs)
  useEffect(() => {
    let cancelled = false;

    async function hydrateUser() {
      try {
        const currentUser = await getAuthenticatedUserFromBackend();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    }

    void hydrateUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep document/settings layers aligned with the active React session (must run before child useEffects).
  useLayoutEffect(() => {
    if (user === undefined) {
      return;
    }
    setSessionOverride(user);
  }, [user]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleSelectDocument = (id: string | null) => {
    setSelectedDocumentId(id);
  };

  const handleBackToList = () => {
    setSelectedDocumentId(undefined);
  };

  // Loading state while checking authentication
  if (user === undefined) {
    return <LoadingSpinner className={UI_CONSTANTS.GRADIENT_BACKGROUND} />;
  }

  // Show login if no user
  if (!user) {
    return (
      <div className="size-full">
        {authView === 'login' ? (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onCreateAccount={() => setAuthView('signup')}
            onForgotPassword={() => setAuthView('forgot')}
          />
        ) : authView === 'signup' ? (
          <SignUp
            onCancel={() => setAuthView('login')}
            onAccountCreated={() => setAuthView('login')}
          />
        ) : authView === 'forgot' ? (
          <ForgotPassword
            onCancel={() => setAuthView('login')}
            onProceedToEnterCode={(email) => {
              setPasswordResetEmail(email);
              setAuthView('reset-confirm');
            }}
          />
        ) : (
          <ResetPasswordConfirm
            initialEmail={passwordResetEmail}
            onBack={() => setAuthView('forgot')}
            onSuccess={() => setAuthView('login')}
          />
        )}
        <Toaster />
      </div>
    );
  }

  // Show main app if authenticated
  return (
    <div className="size-full">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>
      
      <main id="main-content">
        {selectedDocumentId === undefined ? (
          <DocumentList user={user} onSelectDocument={handleSelectDocument} />
        ) : (
          <Editor documentId={selectedDocumentId} onBack={handleBackToList} />
        )}
      </main>
      <Toaster />
    </div>
  );
}