import type { Folder } from "../../models/document";

export function sortedChildFolders(folders: Folder[], parentFolderId: string | null): Folder[] {
  return folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
