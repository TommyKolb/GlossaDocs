import { LogOut, Upload } from 'lucide-react';
import { CreateDocumentButton } from './CreateDocumentButton';
import { Button } from './ui/button';
import { getCurrentUser, logout } from '../utils/auth';
import { toast } from 'sonner';

interface DocumentListHeroProps {
  onCreateDocument: () => void;
  onUploadDocument: () => void;
}

export function DocumentListHero({ onCreateDocument, onUploadDocument }: DocumentListHeroProps) {
  const user = getCurrentUser();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      // Reload the page to reset app state
      window.location.reload();
    } catch (error) {
      toast.error('Failed to logout');
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="text-center mb-8 sm:mb-12">
      {/* Welcome Section */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2">
          Welcome to GlossaDocs
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
          Create, edit, and manage your documents with multi-language support
        </p>
      </div>

      {/* Decorative Greek words - filling the space */}
      <div className="my-4 sm:my-6 flex items-center justify-center gap-3 sm:gap-6 px-4" aria-hidden="true">
        <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-blue-300/60 select-none">
          γλῶσσα
        </div>
        <div className="text-xl sm:text-2xl md:text-3xl font-serif text-indigo-300/50 select-none">
          λόγος
        </div>
        <div className="text-2xl sm:text-3xl md:text-4xl font-serif text-blue-300/60 select-none">
          γράφω
        </div>
      </div>

      {/* Create and Upload buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 px-4">
        <CreateDocumentButton onClick={onCreateDocument} variant="primary" />
        <Button
          variant="outline"
          size="lg"
          onClick={onUploadDocument}
          className="gap-2 px-6 w-full sm:w-auto"
          aria-label="Upload a document from your device"
        >
          <Upload className="size-4" aria-hidden="true" />
          Upload Document
        </Button>
      </div>

      {/* User info and logout */}
      {user && (
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-gray-600">
          <span className="font-medium">
            Logged in as: <span className="text-blue-600">{user.username}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
            aria-label="Sign out of your account"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      )}
    </div>
  );
}