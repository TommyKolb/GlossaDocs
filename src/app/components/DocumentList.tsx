import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { Document, getAllDocuments, deleteDocument, saveDocument } from '../utils/db';
import { importDocumentFile, isSupportedDocumentFile } from '../utils/import';
import { DocumentListHero } from './DocumentListHero';
import { EmptyDocumentState } from './EmptyDocumentState';
import { DocumentCard } from './DocumentCard';
import { LoadingSpinner } from './LoadingSpinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { UI_CONSTANTS } from '../utils/constants';
import { toast } from 'sonner';

interface DocumentListProps {
  onSelectDocument: (id: string | null) => void;
}

export function DocumentList({ onSelectDocument }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    onSelectDocument(null);
  }

  function handleUpload() {
    uploadInputRef.current?.click();
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!isSupportedDocumentFile(file)) {
      toast.error('Please upload a .txt or .docx file');
      event.target.value = '';
      return;
    }

    try {
      // Show loading toast
      const loadingToast = toast.loading(`Importing ${file.name}...`);
      
      // Import the document
      const newDoc = await importDocumentFile(file);
      
      // Save to database
      await saveDocument(newDoc);
      
      // Reload documents list
      await loadDocuments();
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(`${newDoc.title} imported successfully!`);
      
      // Open the newly imported document
      onSelectDocument(newDoc.id);
    } catch (error) {
      console.error('Error importing document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import document');
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }

  function handleDelete(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    setPendingDeleteId(id);
    setIsDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;

    setIsDeleting(true);
    try {
      await deleteDocument(pendingDeleteId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setPendingDeleteId(null);
    }
  }

  const pendingDeleteDocument = documents.find((doc) => doc.id === pendingDeleteId);

  if (loading) {
    return <LoadingSpinner message="Loading documents..." />;
  }

  return (
    <div className={`min-h-screen ${UI_CONSTANTS.GRADIENT_BACKGROUND}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hidden file input for document upload */}
        <input
          ref={uploadInputRef}
          type="file"
          accept=".txt,.docx"
          onChange={handleFileSelect}
          className="sr-only"
          aria-label="Upload document file"
        />

        {/* Hero Section */}
        <DocumentListHero onCreateDocument={handleCreateNew} onUploadDocument={handleUpload} />

        {/* Documents section */}
        {documents.length === 0 ? (
          <EmptyDocumentState onCreateDocument={handleCreateNew} />
        ) : (
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 px-2 sm:px-0">
              <FileText className="size-5 sm:size-6" aria-hidden="true" />
              <span>Your Documents</span>
              <span className="sr-only">({documents.length} document{documents.length !== 1 ? 's' : ''})</span>
            </h2>
            <div className="grid gap-3 sm:gap-4" aria-label="Document list">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onSelect={onSelectDocument}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently delete "${pendingDeleteDocument?.title || 'Untitled Document'}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void confirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}