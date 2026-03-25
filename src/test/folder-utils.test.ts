import { describe, expect, it } from "vitest";

import { sortedChildFolders } from "@/app/components/document-list/folder-utils";
import type { Folder } from "@/app/models/document";

const base = (overrides: Partial<Folder> & Pick<Folder, "id" | "name" | "parentFolderId">): Folder => ({
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

describe("sortedChildFolders", () => {
  it("returns direct children of the given parent sorted by name", () => {
    const folders: Folder[] = [
      base({ id: "a", name: "Zebra", parentFolderId: null }),
      base({ id: "b", name: "Alpha", parentFolderId: null }),
      base({ id: "c", name: "Nested", parentFolderId: "a" })
    ];
    const roots = sortedChildFolders(folders, null);
    expect(roots.map((f) => f.id)).toEqual(["b", "a"]);
    expect(sortedChildFolders(folders, "a").map((f) => f.id)).toEqual(["c"]);
  });

  it("treats null parent as root level only", () => {
    const folders: Folder[] = [
      base({ id: "x", name: "Root", parentFolderId: null }),
      base({ id: "y", name: "Child", parentFolderId: "x" })
    ];
    expect(sortedChildFolders(folders, null)).toHaveLength(1);
    expect(sortedChildFolders(folders, "x")).toHaveLength(1);
  });
});
