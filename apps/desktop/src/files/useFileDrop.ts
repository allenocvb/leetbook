import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { type RefObject, useEffect, useRef, useState } from "react";

/** Native Tauri drops contain paths, not browser File objects. macOS uses logical points; other platforms use physical pixels. */
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
    let transfer: number | undefined;
    const stops: (() => void)[] = [];
    const handle = (
      payload: {
        type: string;
        position?: { x: number; y: number };
        paths?: string[];
        error?: string;
        transferId?: number;
      },
      logical = false,
    ) => {
      if (disposed) return;
      if (payload.type === "leave") {
        setDragging(false);
        return;
      }
      if (!payload.position) return;
      // Wry 0.55 passes AppKit points unchanged on macOS despite the PhysicalPosition type.
      const scale = logical || /Mac/.test(navigator.platform) ? 1 : window.devicePixelRatio;
      const point = { x: payload.position.x / scale, y: payload.position.y / scale };
      const bounds = target.current?.getBoundingClientRect();
      const inside =
        !!bounds &&
        point.x >= bounds.left &&
        point.x <= bounds.right &&
        point.y >= bounds.top &&
        point.y <= bounds.bottom;
      if (logical && payload.type === "receiving")
        transfer = inside ? payload.transferId : undefined;
      if (logical && ["drop", "error"].includes(payload.type) && transfer !== payload.transferId)
        return;
      setDragging(inside && ["enter", "over", "receiving"].includes(payload.type));
      if (inside && payload.type === "drop" && payload.paths?.length)
        callbacks.current.onDrop(payload.paths, point);
      if (inside && payload.type === "error")
        callbacks.current.onError(payload.error ?? "Could not receive this screenshot.");
    };
    const subscribe = (subscription: Promise<() => void>) => {
      void subscription
        .then((stop) => {
          if (disposed) stop();
          else stops.push(stop);
        })
        .catch(() => {
          if (!disposed)
            callbacks.current.onError(
              "Drag-and-drop is unavailable. Use the upload button instead.",
            );
        });
    };
    subscribe(getCurrentWebview().onDragDropEvent(({ payload }) => handle(payload)));
    subscribe(
      listen("leetbook://promised-drop", ({ payload }) =>
        handle(payload as Parameters<typeof handle>[0], true),
      ),
    );
    return () => {
      disposed = true;
      for (const stop of stops) stop();
    };
  }, [target]);
  return dragging;
}
