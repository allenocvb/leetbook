import type { LibraryFile, LibraryFolder } from "@leetbook/core";
import type { DropZone } from "./rowDrop.js";
import type { LibraryItem } from "./useFileLibrary.js";

/** Ids of the item's siblings of the same kind in `folderId`, in display order. */
export function siblingIds(
  item: LibraryItem,
  folderId: string | null,
  files: readonly LibraryFile[],
  folders: readonly LibraryFolder[],
): string[] {
  return item.kind === "file"
    ? files.filter((file) => file.folderId === folderId).map((file) => file.id)
    : folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id);
}

/**
 * The id an item should be placed before for a drop on `targetId`'s edge, or for an Alt+arrow
 * step. `null` means the end of the list; `undefined` means there is nowhere to go.
 */
export function placeBefore(
  ids: readonly string[],
  item: LibraryItem,
  targetId: string,
  zone: Exclude<DropZone, "into">,
): string | null {
  if (zone === "before") return targetId;
  const rest = ids.filter((id) => id !== item.id);
  return rest[rest.indexOf(targetId) + 1] ?? null;
}

export function stepBefore(
  ids: readonly string[],
  item: LibraryItem,
  direction: "up" | "down",
): string | null | undefined {
  const index = ids.indexOf(item.id);
  if (index === -1) return undefined;
  if (direction === "up") return index === 0 ? undefined : ids[index - 1];
  if (index === ids.length - 1) return undefined;
  return ids[index + 2] ?? null;
}
