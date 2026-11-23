import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { type RefObject, useEffect, useRef, useState } from "react";

/** Native Tauri drops contain paths, not browser File objects. Coordinates are physical. */
export function useFileDrop(
  target: RefObject<HTMLElement | null>,
  onDrop: (paths: string[], point: { x: number; y: number }) => void,
  onError: (message: string) => void,
) {
  const [dragging, setDragging] = useState(false);
  const callbacks = useRef({ onDrop, onError });
  callbacks.current = { onDrop, onError };
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (disposed) return;
        if (payload.type === "leave") {
          setDragging(false);
          return;
        }
        const point = {
          x: payload.position.x / window.devicePixelRatio,
          y: payload.position.y / window.devicePixelRatio,
        };
        const bounds = target.current?.getBoundingClientRect();
        const inside =
          !!bounds &&
          point.x >= bounds.left &&
          point.x <= bounds.right &&
          point.y >= bounds.top &&
          point.y <= bounds.bottom;
        setDragging(inside && payload.type !== "drop");
        if (inside && payload.type === "drop") callbacks.current.onDrop(payload.paths, point);
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {
        if (!disposed)
          callbacks.current.onError("Drag-and-drop is unavailable. Use the upload button instead.");
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [target]);
  return dragging;
}
