/**
 * A file dropped anywhere the page doesn't handle would otherwise make the webview navigate to
 * it, replacing the whole app. Drops the editor or Files page handle call preventDefault
 * themselves; this only catches the rest.
 */
export function preventStrayFileDrops(target: Window = window): () => void {
  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
  const over = (event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault();
  };
  target.addEventListener("dragover", over);
  target.addEventListener("drop", drop);
  return () => {
    target.removeEventListener("dragover", over);
    target.removeEventListener("drop", drop);
  };
}
