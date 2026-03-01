import { useState, useEffect } from 'react';
import { DocumentList } from './components/DocumentList';
import { Editor } from './components/Editor';
import { Login } from './components/Login';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Toaster } from './components/ui/sonner';
import { getCurrentUser, type User } from './utils/auth';
import { UI_CONSTANTS } from './utils/constants';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null | undefined>(undefined);

  // Check for existing user session on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

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
        <Login onLoginSuccess={handleLoginSuccess} />
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
          <DocumentList onSelectDocument={handleSelectDocument} />
        ) : (
          <Editor documentId={selectedDocumentId} onBack={handleBackToList} />
        )}
      </main>
      <Toaster />
    </div>
  );
}