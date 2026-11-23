import type { LibraryItem } from "./useFileLibrary.js";

export type DropZone = "before" | "after" | "into";

/**
 * Where a dragged item would land on a row, given how far down the row the pointer is (0–1).
 * Folders list before files, so a file dropped on a folder always goes into it, and a folder
 * can't be ordered among files. A folder dropped on another folder's edge reorders; its middle
 * moves the folder inside.
 */
export function dropZone(
  target: LibraryItem,
  dragged: LibraryItem,
  fraction: number,
): DropZone | null {
  if (target.kind === dragged.kind && target.id === dragged.id) return null;
  if (target.kind === "folder") {
    if (dragged.kind === "file") return "into";
    if (fraction < 0.25) return "before";
    if (fraction > 0.75) return "after";
    return "into";
  }
  if (dragged.kind === "folder") return null;
  return fraction < 0.5 ? "before" : "after";
}

/** Marks our own row drags so file drops from the OS are left to the upload path. */
export const LIBRARY_DRAG_TYPE = "application/x-leetbook-library-item";
