import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Finder file and folder drops, which Tauri reports as paths rather than browser File objects.
 * macOS uses logical points; other platforms use physical pixels. Drags that start inside the
 * app, and file promises such as the floating screenshot thumbnail, reach the page as ordinary
 * HTML5 drag events instead (see `drag_routing.m`).
 */
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
    const stops: (() => void)[] = [];
    const handle = (payload: {
      type: string;
      position?: { x: number; y: number };
      paths?: string[];
    }) => {
      if (disposed) return;
      if (payload.type === "leave") {
        setDragging(false);
        return;
      }
      if (!payload.position) return;
      // Wry 0.55 passes AppKit points unchanged on macOS despite the PhysicalPosition type.
      const scale = /Mac/.test(navigator.platform) ? 1 : window.devicePixelRatio;
      const point = { x: payload.position.x / scale, y: payload.position.y / scale };
      const bounds = target.current?.getBoundingClientRect();
      const inside =
        !!bounds &&
        point.x >= bounds.left &&
        point.x <= bounds.right &&
        point.y >= bounds.top &&
        point.y <= bounds.bottom;
      setDragging(inside && ["enter", "over"].includes(payload.type));
      if (inside && payload.type === "drop" && payload.paths?.length)
        callbacks.current.onDrop(payload.paths, point);
    };
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => handle(payload))
      .then((stop) => {
        if (disposed) stop();
        else stops.push(stop);
      })
      .catch(() => {
        if (!disposed)
          callbacks.current.onError("Drag-and-drop is unavailable. Use the upload button instead.");
      });
    return () => {
      disposed = true;
      for (const stop of stops) stop();
    };
  }, [target]);
  return dragging;
}
