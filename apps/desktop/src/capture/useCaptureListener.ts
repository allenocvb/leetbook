import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { ListenerSummary } from "../components/Sidebar.js";
import { useDb } from "../db/DbContext.js";
import { ingestCapture } from "./ingest.js";

interface PairingInfo {
  port: number;
  token: string;
  listening: boolean;
}

/** True when running inside the real Tauri shell (not vite dev / tests). */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Subscribes to captures forwarded by the Rust listener and ingests them. */
export function useCaptureListener(onIngested: (slug: string) => void): ListenerSummary {
  const db = useDb();
  const [listener, setListener] = useState<ListenerSummary>(() =>
    inTauri() ? { state: "checking", port: null } : { state: "offline", port: null },
  );

  useEffect(() => {
    if (!inTauri()) return;
    let disposed = false;

    const unlistenPromise = listen<string>("leetbook://capture", (event) => {
      void ingestCapture(db, event.payload, new Date()).then((result) => {
        if (result.ok) onIngested(result.slug);
        else console.warn("[LeetBook] rejected capture:", result.error);
      });
    });

    void invoke<PairingInfo>("get_pairing_info")
      .then((info) => {
        if (!disposed) {
          setListener({
            state: info.listening ? "listening" : "offline",
            port: info.port,
          });
        }
      })
      .catch(() => {
        if (!disposed) setListener({ state: "offline", port: null });
      });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [db, onIngested]);

  return listener;
}
