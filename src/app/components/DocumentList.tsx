import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { FileText, Folder as FolderIcon, FolderPlus, Pencil, Trash } from 'lucide-react';
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
import { FolderBreadcrumbs } from './document-list/FolderBreadcrumbs';
import { FolderMutationDialogs } from './document-list/FolderMutationDialogs';
import { MoveDocumentDialog } from './document-list/MoveDocumentDialog';
import { sortedChildFolders } from './document-list/folder-utils';
import { useDocumentDragPreview } from './document-list/useDocumentDragPreview';
import { UI_CONSTANTS } from '../utils/constants';
import { DOCUMENT_PAYLOAD_TOO_LARGE_MESSAGE, isPayloadTooLargeError } from '../api/client';
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
  const [draggingDocumentId, setDraggingDocumentId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] = useState(false);
  const [renameFolderNameInput, setRenameFolderNameInput] = useState('');
  const [isFolderDeleteAlertOpen, setIsFolderDeleteAlertOpen] = useState(false);
  const [isFolderMutating, setIsFolderMutating] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const {
    onDragStartDocument,
    onDragDocument,
    onDragEndDocument,
    updatePointerFromDragEvent
  } = useDocumentDragPreview(setDraggingDocumentId, setDropTargetFolderId);

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
      if (isPayloadTooLargeError(error)) {
        toast.error(DOCUMENT_PAYLOAD_TOO_LARGE_MESSAGE);
      } else {
        toast.error('Failed to move document');
      }
    }
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

  function openCreateFolderDialog(): void {
    setNewFolderNameInput('');
    setIsCreateFolderDialogOpen(true);
  }

  async function confirmCreateFolder(): Promise<void> {
    const name = newFolderNameInput.trim();
    if (!name) {
      toast.error('Please enter a folder name');
      return;
    }
    setIsFolderMutating(true);
    try {
      await createFolder(name, activeFolderId);
      await loadDocuments();
      setIsCreateFolderDialogOpen(false);
      setNewFolderNameInput('');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    } finally {
      setIsFolderMutating(false);
    }
  }

  function openRenameFolderDialog(): void {
    if (!activeFolderId) {
      return;
    }
    const current = folderById(activeFolderId);
    setRenameFolderNameInput(current?.name ?? '');
    setIsRenameFolderDialogOpen(true);
  }

  async function confirmRenameFolder(): Promise<void> {
    if (!activeFolderId) {
      return;
    }
    const current = folderById(activeFolderId);
    const name = renameFolderNameInput.trim();
    if (!name) {
      toast.error('Please enter a folder name');
      return;
    }
    if (!current) {
      return;
    }
    setIsFolderMutating(true);
    try {
      await updateFolder({ ...current, name });
      await loadDocuments();
      setIsRenameFolderDialogOpen(false);
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('Failed to rename folder');
    } finally {
      setIsFolderMutating(false);
    }
  }

  async function confirmDeleteFolder(): Promise<void> {
    if (!activeFolderId) {
      return;
    }
    const current = folderById(activeFolderId);
    setIsFolderMutating(true);
    try {
      await deleteFolder(activeFolderId);
      setActiveFolderId(current?.parentFolderId ?? null);
      await loadDocuments();
      setIsFolderDeleteAlertOpen(false);
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    } finally {
      setIsFolderMutating(false);
    }
  }

  const pendingDeleteDocument = documents.find((doc) => doc.id === pendingDeleteId);
  const activeFolder = folderById(activeFolderId);
  const visibleFolders = sortedChildFolders(folders, activeFolderId);
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
                onClick={() => openCreateFolderDialog()}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
              >
                <FolderPlus className="size-4" aria-hidden="true" />
                New Folder
              </button>
            </div>

            {(activeFolderId || breadcrumbs.length > 0) && (
              <FolderBreadcrumbs
                breadcrumbs={breadcrumbs}
                activeFolder={activeFolder}
                onNavigateUp={() => setActiveFolderId(activeFolder?.parentFolderId ?? null)}
                onSelectFolder={setActiveFolderId}
                folderActions={
                  activeFolderId ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openRenameFolderDialog()}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Rename Folder
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFolderDeleteAlertOpen(true)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border text-red-700 bg-white hover:bg-red-50"
                      >
                        <Trash className="size-3.5" aria-hidden="true" />
                        Delete Folder
                      </button>
                    </>
                  ) : undefined
                }
              />
            )}

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
              aria-label="Document list"
              onDrop={() => {
                setDropTargetFolderId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                updatePointerFromDragEvent(event);
              }}
            >
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
                    event.dataTransfer.dropEffect = 'move';
                    setDropTargetFolderId((current) => (current === folder.id ? current : folder.id));
                    updatePointerFromDragEvent(event);
                  }}
                  onDragLeave={() => {
                    setDropTargetFolderId((current) => (current === folder.id ? null : current));
                  }}
                  onDrop={(event) => {
                    void handleDropOnFolder(folder.id, event);
                  }}
                >
                  <div className="inline-flex items-center gap-2 text-gray-800">
                    <FolderIcon className="size-5 text-blue-600" />
                    <span className="font-medium truncate">{folder.name}</span>
                  </div>
                  {draggingDocumentId && (
                    <p className="mt-2 text-xs text-gray-500">Drop document here</p>
                  )}
                </button>
              ))}

              {visibleDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onSelect={onSelectDocument}
                  onDelete={handleDelete}
                  onRequestMove={openMoveDialog}
                  onDragStartDocument={onDragStartDocument}
                  onDragDocument={onDragDocument}
                  onDragEndDocument={onDragEndDocument}
                  isDragging={draggingDocumentId === doc.id}
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

      <MoveDocumentDialog
        open={isMoveDialogOpen}
        onOpenChange={(open) => {
          setIsMoveDialogOpen(open);
          if (!open) {
            setMovingDocumentId(null);
          }
        }}
        folders={folders}
        expandedFolderIds={expandedFolderIds}
        onToggleFolderExpanded={toggleFolderExpanded}
        moveTargetFolderId={moveTargetFolderId}
        onSelectMoveTarget={setMoveTargetFolderId}
        onConfirmMove={() => {
          void confirmMoveInDialog();
        }}
      />

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

      <FolderMutationDialogs
        createOpen={isCreateFolderDialogOpen}
        onCreateOpenChange={setIsCreateFolderDialogOpen}
        newFolderName={newFolderNameInput}
        onNewFolderNameChange={setNewFolderNameInput}
        onConfirmCreate={confirmCreateFolder}
        renameOpen={isRenameFolderDialogOpen}
        onRenameOpenChange={setIsRenameFolderDialogOpen}
        renameFolderName={renameFolderNameInput}
        onRenameFolderNameChange={setRenameFolderNameInput}
        onConfirmRename={confirmRenameFolder}
        deleteOpen={isFolderDeleteAlertOpen}
        onDeleteOpenChange={setIsFolderDeleteAlertOpen}
        folderNameForDelete={activeFolder?.name ?? 'Folder'}
        onConfirmDelete={confirmDeleteFolder}
        isMutating={isFolderMutating}
      />
    </div>
  );
}