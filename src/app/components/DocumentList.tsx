import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FileText, Folder as FolderIcon, FolderPlus, Pencil, Trash, ChevronLeft } from 'lucide-react';
import type { Document, Folder } from '../models/document';
import {
  getAllDocuments,
  getAllFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  deleteDocument,
  saveDocument
} from '../data/document-repository';
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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
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
      const [docs, allFolders] = await Promise.all([getAllDocuments(), getAllFolders()]);
      setDocuments(docs);
      setFolders(allFolders);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    if (activeFolderId) {
      localStorage.setItem('glossadocs_new_document_folder_id', activeFolderId);
    } else {
      localStorage.removeItem('glossadocs_new_document_folder_id');
    }
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
      newDoc.folderId = activeFolderId;
      
      // Save to database
      const persistedDoc = await saveDocument(newDoc);
      
      // Reload documents list
      await loadDocuments();
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(`${newDoc.title} imported successfully!`);
      
      // Open the newly imported document
      onSelectDocument(persistedDoc.id);
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

  async function handleMoveDocumentToFolder(documentId: string, folderId: string | null): Promise<void> {
    const document = documents.find((doc) => doc.id === documentId);
    if (!document) {
      return;
    }
    try {
      await saveDocument({ ...document, folderId, updatedAt: Date.now() });
      await loadDocuments();
    } catch (error) {
      console.error('Error moving document:', error);
      toast.error('Failed to move document');
    }
  }

  function childFolders(parentFolderId: string | null): Folder[] {
    return folders
      .filter((folder) => folder.parentFolderId === parentFolderId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function folderById(id: string | null): Folder | null {
    if (!id) {
      return null;
    }
    return folders.find((folder) => folder.id === id) ?? null;
  }

  function folderAncestors(folderId: string | null): Folder[] {
    const chain: Folder[] = [];
    let cursor = folderById(folderId);
    while (cursor) {
      chain.unshift(cursor);
      cursor = folderById(cursor.parentFolderId);
    }
    return chain;
  }

  async function handleCreateFolder() {
    const name = window.prompt('Folder name');
    if (!name || !name.trim()) {
      return;
    }
    try {
      await createFolder(name.trim(), activeFolderId);
      await loadDocuments();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  }

  async function handleRenameFolder() {
    if (!activeFolderId) {
      return;
    }
    const current = folderById(activeFolderId);
    const name = window.prompt('Rename folder', current?.name ?? '');
    if (!name || !name.trim()) {
      return;
    }
    if (!current) {
      return;
    }
    try {
      await updateFolder({ ...current, name: name.trim() });
      await loadDocuments();
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('Failed to rename folder');
    }
  }

  async function handleDeleteFolder() {
    if (!activeFolderId) {
      return;
    }
    const current = folderById(activeFolderId);
    const accepted = window.confirm(
      `Delete folder "${current?.name ?? 'Folder'}"? Items inside will move to the parent folder.`
    );
    if (!accepted) {
      return;
    }
    try {
      await deleteFolder(activeFolderId);
      setActiveFolderId(current?.parentFolderId ?? null);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  }

  const pendingDeleteDocument = documents.find((doc) => doc.id === pendingDeleteId);
  const activeFolder = folderById(activeFolderId);
  const visibleFolders = childFolders(activeFolderId);
  const visibleDocuments = documents
    .filter((doc) => doc.folderId === activeFolderId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const breadcrumbs = folderAncestors(activeFolderId);

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
        {documents.length === 0 && folders.length === 0 ? (
          <EmptyDocumentState onCreateDocument={handleCreateNew} />
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                  <FolderIcon className="size-5 sm:size-6" aria-hidden="true" />
                  <span>Folders</span>
                </h2>
                <button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
                >
                  <FolderPlus className="size-4" />
                  New Folder
                </button>
              </div>

              <div className="mb-4 text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => setActiveFolderId(null)}
                >
                  My Drive
                </button>
                {breadcrumbs.map((folder) => (
                  <span key={folder.id} className="inline-flex items-center gap-2">
                    <span>/</span>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => setActiveFolderId(folder.id)}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {activeFolderId && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleRenameFolder()}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
                  >
                    <Pencil className="size-4" />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteFolder()}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border text-red-700 bg-white hover:bg-red-50"
                  >
                    <Trash className="size-4" />
                    Delete
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {activeFolderId && (
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(activeFolder?.parentFolderId ?? null)}
                    className="text-left p-4 rounded-lg border border-gray-200 bg-white/90 hover:shadow-md transition-all"
                  >
                    <div className="inline-flex items-center gap-2 text-gray-700">
                      <ChevronLeft className="size-5" />
                      <span className="font-medium">Back</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Go to parent folder</p>
                  </button>
                )}
                {visibleFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    className="text-left p-4 rounded-lg border border-gray-200 bg-white/90 hover:shadow-md transition-all"
                  >
                    <div className="inline-flex items-center gap-2 text-gray-800">
                      <FolderIcon className="size-5 text-blue-600" />
                      <span className="font-medium truncate">{folder.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Open folder</p>
                  </button>
                ))}
              </div>
              {visibleFolders.length === 0 && (
                <div className="text-sm text-gray-500 px-1 mt-3">
                  No subfolders here yet. Create one to organize your documents.
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 px-2 sm:px-0">
                <FileText className="size-5 sm:size-6" aria-hidden="true" />
                <span>Your Documents</span>
                <span className="sr-only">
                  ({visibleDocuments.length} document{visibleDocuments.length !== 1 ? 's' : ''})
                </span>
              </h2>
              <div className="grid gap-3 sm:gap-4" aria-label="Document list">
                {visibleDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    folders={folders}
                    onSelect={onSelectDocument}
                    onDelete={handleDelete}
                    onMoveToFolder={handleMoveDocumentToFolder}
                  />
                ))}
                {visibleDocuments.length === 0 && (
                  <div className="text-sm text-gray-500 px-2">No documents in this folder yet.</div>
                )}
              </div>
            </section>
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