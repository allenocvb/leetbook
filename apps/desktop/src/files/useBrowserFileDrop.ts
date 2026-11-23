import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * HTML5 file drops on `target`: what WebKit delivers for file promises such as the Cmd-Shift-4
 * floating thumbnail (Finder file drags come through Tauri as paths instead, see useFileDrop).
 * Drags of the page's own rows carry no files and are ignored here.
 */
export function useBrowserFileDrop(
  target: RefObject<HTMLElement | null>,
  onDrop: (files: File[]) => void,
): boolean {
  const [dragging, setDragging] = useState(false);
  const callback = useRef(onDrop);
  callback.current = onDrop;
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!element.contains(event.relatedTarget as Node | null)) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      callback.current(files);
    };
    element.addEventListener("dragover", over);
    element.addEventListener("dragleave", leave);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragover", over);
      element.removeEventListener("dragleave", leave);
      element.removeEventListener("drop", drop);
    };
  }, [target]);
  return dragging;
}
