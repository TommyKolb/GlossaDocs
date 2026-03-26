import * as React from "react";
import { Folder as FolderIcon, ChevronDown, ChevronRight } from "lucide-react";
import type { Folder } from "../../models/document";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { sortedChildFolders } from "./folder-utils";

interface MoveDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  expandedFolderIds: Set<string>;
  onToggleFolderExpanded: (folderId: string) => void;
  moveTargetFolderId: string | null;
  onSelectMoveTarget: (folderId: string | null) => void;
  onConfirmMove: () => void;
}

export function MoveDocumentDialog({
  open,
  onOpenChange,
  folders,
  expandedFolderIds,
  onToggleFolderExpanded,
  moveTargetFolderId,
  onSelectMoveTarget,
  onConfirmMove
}: MoveDocumentDialogProps) {
  function renderFolderTree(parentFolderId: string | null, depth = 0): React.ReactNode {
    return sortedChildFolders(folders, parentFolderId).map((folder) => {
      const children = sortedChildFolders(folders, folder.id);
      const hasChildren = children.length > 0;
      const isExpanded = expandedFolderIds.has(folder.id);
      const isSelected = moveTargetFolderId === folder.id;

      return (
        <div key={folder.id} role="listitem">
          <div
            className={`flex items-center gap-1 rounded-md px-2 py-1 ${
              isSelected ? "bg-blue-50 border border-blue-200" : "border border-transparent"
            }`}
            style={{ marginLeft: `${depth * 14}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100"
                onClick={() => onToggleFolderExpanded(folder.id)}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`}
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
              onClick={() => onSelectMoveTarget(folder.id)}
              aria-pressed={isSelected}
            >
              <span className="inline-flex items-center gap-2">
                <FolderIcon className="size-4 text-blue-600" />
                {folder.name}
              </span>
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div role="list" className="mt-0.5">
              {renderFolderTree(folder.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(openNext) => {
        onOpenChange(openNext);
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
          role="list"
          aria-label="Folder destinations"
        >
          <div
            className={`rounded-md px-2 py-1 mb-1 ${moveTargetFolderId === null ? "bg-blue-50 border border-blue-200" : ""}`}
            role="listitem"
          >
            <button
              type="button"
              className="w-full text-left text-sm rounded px-1 py-1 hover:bg-gray-100"
              onClick={() => onSelectMoveTarget(null)}
              aria-pressed={moveTargetFolderId === null}
            >
              No folder
            </button>
          </div>
          {renderFolderTree(null)}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirmMove();
            }}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
