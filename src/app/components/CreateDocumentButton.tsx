import { Plus } from 'lucide-react';
import { Button } from './ui/button';

interface CreateDocumentButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function CreateDocumentButton({ onClick, variant = 'primary' }: CreateDocumentButtonProps) {
  const isPrimary = variant === 'primary';
  
  return (
    <Button 
      onClick={onClick} 
      size="lg"
      className={`gap-2 sm:gap-3 text-base sm:text-lg py-4 sm:py-6 w-full sm:w-auto ${
        isPrimary 
          ? 'px-8 sm:px-12 shadow-lg hover:shadow-xl transition-all' 
          : 'px-6 sm:px-8'
      }`}
      aria-label={isPrimary ? 'Create a new document' : 'Create your first document'}
    >
      <Plus className={isPrimary ? 'size-5 sm:size-6' : 'size-4 sm:size-5'} aria-hidden="true" />
      <span className="hidden sm:inline">{isPrimary ? 'Create New Document' : 'Create Your First Document'}</span>
      <span className="sm:hidden">{isPrimary ? 'New Document' : 'First Document'}</span>
    </Button>
  );
}