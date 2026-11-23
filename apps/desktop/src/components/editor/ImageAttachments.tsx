import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Editor, EditorEvents } from "@tiptap/react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { imageDataUrl, nativeImage } from "../../files/noteImages.js";
import { useFileDrop } from "../../files/useFileDrop.js";
import { Button } from "../ui/Button.js";

export function ImageAttachments({
  editor,
  container,
}: {
  editor: Editor | null;
  container: RefObject<HTMLDivElement | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const insert = useCallback(
    async (sources: (File | string)[], position?: number) => {
      if (!editor || editor.isDestroyed || working.current || sources.length === 0) return;
      working.current = true;
      setBusy(true);
      setError("");
      let at = position ?? editor.state.selection.from;
      // Keep the intended drop/caret position valid if the user types while an image loads.
      const track = ({ transaction }: EditorEvents["transaction"]) => {
        at = transaction.mapping.map(at);
      };
      editor.on("transaction", track);
      const failures: string[] = [];
      try {
        const images = [];
        for (const source of sources) {
          try {
            const file = typeof source === "string" ? await nativeImage(source) : source;
            images.push({
              type: "image",
              attrs: { src: await imageDataUrl(file), alt: file.name },
            });
          } catch (reason) {
            failures.push(String(reason));
          }
        }
        if (!editor.isDestroyed && images.length) {
          editor
            .chain()
            .focus()
            .insertContentAt(at, [...images, { type: "paragraph" }])
            .run();
        }
        if (!editor.isDestroyed) setError(failures.join(" "));
      } finally {
        editor.off("transaction", track);
        working.current = false;
        if (!editor.isDestroyed) setBusy(false);
      }
    },
    [editor],
  );
  const positionAt = (point: { x: number; y: number }) =>
    editor?.view.posAtCoords({ left: point.x, top: point.y })?.pos;
  const dragging = useFileDrop(
    container,
    (paths, point) => void insert(paths, positionAt(point)),
    setError,
  );
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      void insert(files);
    };
    const drop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return; // Leave internal block dragging to ProseMirror.
      event.preventDefault();
      event.stopPropagation();
      void insert(files, editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
    };
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    dom.addEventListener("paste", paste, true);
    dom.addEventListener("drop", drop, true);
    dom.addEventListener("dragover", over);
    return () => {
      dom.removeEventListener("paste", paste, true);
      dom.removeEventListener("drop", drop, true);
      dom.removeEventListener("dragover", over);
    };
  }, [editor, insert]);
  const choose = async () => {
    if (!isTauri()) {
      input.current?.click();
      return;
    }
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
      });
      if (selected) await insert(Array.isArray(selected) ? selected : [selected]);
    } catch (reason) {
      setError(String(reason));
    }
  };
  return (
    <div className={`note-images${dragging ? " note-images--dragging" : ""}`}>
      <div className="note-images__tools">
        <span role="status">
          {dragging
            ? "Drop to insert your screenshot"
            : busy
              ? "Adding images…"
              : "Drop or paste screenshots into your notes"}
        </span>
        <Button
          variant="ghost"
          disabled={!editor || busy}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void choose()}
        >
          + Image
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label="Upload note images"
        onChange={(event) => {
          void insert(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {error && (
        <p className="note-images__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
