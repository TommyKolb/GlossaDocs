import { FileText, Languages } from 'lucide-react';
import { Card } from './ui/card';
import { CreateDocumentButton } from './CreateDocumentButton';

interface EmptyDocumentStateProps {
  onCreateDocument: () => void;
}

export function EmptyDocumentState({ onCreateDocument }: EmptyDocumentStateProps) {
  return (
    <Card 
      className="p-8 sm:p-12 md:p-16 text-center bg-white/80 backdrop-blur border-2 border-dashed border-gray-300"
      role="region"
      aria-label="Empty state"
    >
      <div className="relative">
        <FileText className="size-16 sm:size-20 text-gray-300 mx-auto mb-4 sm:mb-6" aria-hidden="true" />
        <Languages className="size-6 sm:size-8 text-blue-400 absolute top-0 left-1/2 -translate-x-1/2 translate-x-6 sm:translate-x-8 -translate-y-2" aria-hidden="true" />
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
        No documents yet
      </h2>
      <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 max-w-md mx-auto px-4">
        Create your first multilingual document to get started with GlossaDocs
      </p>
      <CreateDocumentButton onClick={onCreateDocument} variant="secondary" />
    </Card>
  );
}