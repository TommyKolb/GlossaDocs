import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FileText, Folder as FolderIcon, FolderPlus, Pencil, Trash, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
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

  function toggleFolderExpanded(folderId: string): void {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function openMoveDialog(documentId: string): void {
    const document = documents.find((doc) => doc.id === documentId);
    setMovingDocumentId(documentId);
    setMoveTargetFolderId(document?.folderId ?? null);
    setIsMoveDialogOpen(true);
  }

  async function confirmMoveInDialog(): Promise<void> {
    if (!movingDocumentId) {
      return;
    }
    await handleMoveDocumentToFolder(movingDocumentId, moveTargetFolderId);
    setIsMoveDialogOpen(false);
    setMovingDocumentId(null);
  }

  function handleDocumentDragStart(documentId: string, event: React.DragEvent<HTMLDivElement>): void {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', documentId);
    event.dataTransfer.setData('application/x-glossadocs-document-id', documentId);
  }

  function handleDocumentDragEnd(): void {
    setDropTargetFolderId(null);
  }

  async function handleDropOnFolder(folderId: string, event: React.DragEvent<HTMLButtonElement>): Promise<void> {
    event.preventDefault();
    const draggedDocumentId =
      event.dataTransfer.getData('application/x-glossadocs-document-id') ||
      event.dataTransfer.getData('text/plain');
    setDropTargetFolderId(null);
    if (!draggedDocumentId) {
      return;
    }
    await handleMoveDocumentToFolder(draggedDocumentId, folderId);
  }

  function renderFolderTree(parentFolderId: string | null, depth = 0): React.ReactNode {
    return childFolders(parentFolderId).map((folder) => {
      const children = childFolders(folder.id);
      const hasChildren = children.length > 0;
      const isExpanded = expandedFolderIds.has(folder.id);
      const isSelected = moveTargetFolderId === folder.id;

      return (
        <div key={folder.id}>
          <div
            className={`flex items-center gap-1 rounded-md px-2 py-1 ${
              isSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'
            }`}
            style={{ marginLeft: `${depth * 14}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100"
                onClick={() => toggleFolderExpanded(folder.id)}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <span className="h-6 w-6 inline-flex items-center justify-center text-gray-300" aria-hidden="true">
                <ChevronRight className="size-4" />
              </span>
            )}
            <button
              type="button"
              className="flex-1 text-left text-sm rounded px-1 py-1 hover:bg-gray-100"
              onClick={() => setMoveTargetFolderId(folder.id)}
              role="treeitem"
              aria-selected={isSelected}
            >
              <span className="inline-flex items-center gap-2">
                <FolderIcon className="size-4 text-blue-600" />
                {folder.name}
              </span>
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div role="group">
              {renderFolderTree(folder.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
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
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2 px-2 sm:px-0">
                <FileText className="size-5 sm:size-6" aria-hidden="true" />
                <span>Your Documents</span>
                <span className="sr-only">
                  ({visibleDocuments.length} document{visibleDocuments.length !== 1 ? 's' : ''})
                </span>
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

            {(activeFolderId || breadcrumbs.length > 0) && (
              <div className="mb-3 sm:mb-4 flex items-center gap-2 flex-wrap text-sm text-gray-600">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  onClick={() => setActiveFolderId(activeFolder?.parentFolderId ?? null)}
                >
                  <ChevronLeft className="size-3.5" />
                  Back
                </button>
                {breadcrumbs.map((folder, index) => (
                  <span key={folder.id} className="inline-flex items-center gap-2">
                    {index > 0 && <span>/</span>}
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
            )}

            {activeFolderId && (
              <div className="mb-3 sm:mb-4 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleRenameFolder()}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                >
                  <Pencil className="size-3.5" />
                  Rename Folder
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteFolder()}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border text-red-700 bg-white hover:bg-red-50"
                >
                  <Trash className="size-3.5" />
                  Delete Folder
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Document list">
              {visibleFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`text-left p-4 rounded-lg border bg-white/90 hover:shadow-md transition-all min-h-[138px] ${
                    dropTargetFolderId === folder.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                  }`}
                  aria-label={`Open folder ${folder.name}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropTargetFolderId(folder.id);
                  }}
                  onDragLeave={() => setDropTargetFolderId(null)}
                  onDrop={(event) => {
                    void handleDropOnFolder(folder.id, event);
                  }}
                >
                  <div className="inline-flex items-center gap-2 text-gray-800">
                    <FolderIcon className="size-5 text-blue-600" />
                    <span className="font-medium truncate">{folder.name}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Drop a document here to move it</p>
                </button>
              ))}

              {visibleDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onSelect={onSelectDocument}
                  onDelete={handleDelete}
                  onRequestMove={openMoveDialog}
                  onDragStartDocument={handleDocumentDragStart}
                  onDragEndDocument={handleDocumentDragEnd}
                />
              ))}
            </div>

            {visibleFolders.length === 0 && visibleDocuments.length === 0 && (
              <div className="text-sm text-gray-500 px-2 mt-3">
                Nothing here yet. Create a document or folder to get started.
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={isMoveDialogOpen}
        onOpenChange={(open) => {
          setIsMoveDialogOpen(open);
          if (!open) {
            setMovingDocumentId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Move Document</DialogTitle>
            <DialogDescription>
              Choose a destination folder. Use the expand buttons to navigate nested folders.
            </DialogDescription>
          </DialogHeader>

          <div
            className="max-h-80 overflow-auto border rounded-md p-2"
            role="tree"
            aria-label="Folder tree"
          >
            <div className={`rounded-md px-2 py-1 mb-1 ${moveTargetFolderId === null ? 'bg-blue-50 border border-blue-200' : ''}`}>
              <button
                type="button"
                className="w-full text-left text-sm rounded px-1 py-1 hover:bg-gray-100"
                onClick={() => setMoveTargetFolderId(null)}
                role="treeitem"
                aria-selected={moveTargetFolderId === null}
              >
                No folder
              </button>
            </div>
            {renderFolderTree(null)}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => setIsMoveDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              onClick={() => {
                void confirmMoveInDialog();
              }}
            >
              Move
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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