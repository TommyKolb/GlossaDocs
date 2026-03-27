import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface FolderMutationDialogsProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onConfirmCreate: () => void | Promise<void>;

  renameOpen: boolean;
  onRenameOpenChange: (open: boolean) => void;
  renameFolderName: string;
  onRenameFolderNameChange: (value: string) => void;
  onConfirmRename: () => void | Promise<void>;

  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  folderNameForDelete: string;
  onConfirmDelete: () => void | Promise<void>;

  isMutating: boolean;
}

export function FolderMutationDialogs({
  createOpen,
  onCreateOpenChange,
  newFolderName,
  onNewFolderNameChange,
  onConfirmCreate,
  renameOpen,
  onRenameOpenChange,
  renameFolderName,
  onRenameFolderNameChange,
  onConfirmRename,
  deleteOpen,
  onDeleteOpenChange,
  folderNameForDelete,
  onConfirmDelete,
  isMutating
}: FolderMutationDialogsProps) {
  return (
    <>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          onCreateOpenChange(open);
          if (!open) {
            onNewFolderNameChange("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Enter a name for the folder. It will be created inside the folder you are viewing, or at the top level if
              you are not inside a folder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="create-folder-name">Folder name</Label>
            <Input
              id="create-folder-name"
              value={newFolderName}
              onChange={(e) => onNewFolderNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onConfirmCreate();
                }
              }}
              autoComplete="off"
              disabled={isMutating}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onCreateOpenChange(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onConfirmCreate()} disabled={isMutating}>
              {isMutating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          onRenameOpenChange(open);
          if (!open) {
            onRenameFolderNameChange("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Change the name of this folder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-folder-name">Folder name</Label>
            <Input
              id="rename-folder-name"
              value={renameFolderName}
              onChange={(e) => onRenameFolderNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onConfirmRename();
                }
              }}
              autoComplete="off"
              disabled={isMutating}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onRenameOpenChange(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onConfirmRename()} disabled={isMutating}>
              {isMutating ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will delete "${folderNameForDelete}". Items inside will move to the parent folder.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void onConfirmDelete();
              }}
              disabled={isMutating}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
            >
              {isMutating ? "Deleting…" : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
