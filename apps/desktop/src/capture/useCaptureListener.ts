import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useDb } from "../db/DbContext.js";
import { ingestCapture } from "./ingest.js";

/** True when running inside the real Tauri shell (not vite dev / tests). */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Subscribes to captures forwarded by the Rust listener and ingests them. */
export function useCaptureListener(onIngested: (slug: string) => void): void {
  const db = useDb();

  useEffect(() => {
    if (!inTauri()) return;
    const unlisten = listen<string>("leetbook://capture", (event) => {
      void ingestCapture(db, event.payload, new Date()).then((result) => {
        if (result.ok) onIngested(result.slug);
        else console.warn("[LeetBook] rejected capture:", result.error);
      });
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [db, onIngested]);
}
