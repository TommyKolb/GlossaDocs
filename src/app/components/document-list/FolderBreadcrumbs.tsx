import * as React from "react";
import { ChevronLeft } from "lucide-react";
import type { Folder } from "../../models/document";

interface FolderBreadcrumbsProps {
  breadcrumbs: Folder[];
  activeFolder: Folder | null;
  onNavigateUp: () => void;
  onSelectFolder: (folderId: string) => void;
  /** Shown inline after the folder path (e.g. rename / delete for the current folder). */
  folderActions?: React.ReactNode;
}

export function FolderBreadcrumbs({
  breadcrumbs,
  activeFolder,
  onNavigateUp,
  onSelectFolder,
  folderActions
}: FolderBreadcrumbsProps) {
  if (!activeFolder && breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 sm:mb-4 flex items-center gap-2 flex-wrap text-sm text-gray-600">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
        onClick={onNavigateUp}
        aria-label="Up to parent folder"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Back
      </button>
      {breadcrumbs.map((folder, index) => (
        <span key={folder.id} className="inline-flex items-center gap-2">
          {index > 0 && <span>/</span>}
          <button type="button" className="hover:underline" onClick={() => onSelectFolder(folder.id)}>
            {folder.name}
          </button>
        </span>
      ))}
      {folderActions != null && (
        <span className="inline-flex items-center gap-2 shrink-0">{folderActions}</span>
      )}
    </div>
  );
}
