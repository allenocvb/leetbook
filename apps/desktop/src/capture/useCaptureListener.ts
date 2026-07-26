import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { ListenerSummary } from "../components/Sidebar.js";
import { useDb } from "../db/DbContext.js";
import { ingestCapture } from "./ingest.js";
import { type LastCapture, loadLastCapture } from "./status.js";

export interface PairingInfo {
  port: number;
  token: string;
  listening: boolean;
  queued: number | null;
}

export interface CaptureRuntime {
  listener: ListenerSummary;
  pairing: PairingInfo | null;
  pairingError: string | null;
  queued: number | null;
  lastCapture: LastCapture | null;
}

/** True when running inside the real Tauri shell (not vite dev / tests). */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Subscribes to the local bridge and exposes truthful listener, queue, and capture state. */
export function useCaptureListener(onIngested: (slug: string) => void): CaptureRuntime {
  const db = useDb();
  const [listener, setListener] = useState<ListenerSummary>(() =>
    inTauri() ? { state: "checking", port: null } : { state: "offline", port: null },
  );
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(() =>
    inTauri() ? null : "Pairing is available in the desktop app.",
  );
  const [queued, setQueued] = useState<number | null>(null);
  const [lastCapture, setLastCapture] = useState<LastCapture | null>(null);

  useEffect(() => {
    let disposed = false;
    void loadLastCapture(db)
      .then((capture) => {
        if (!disposed) setLastCapture(capture);
      })
      .catch(console.warn);
    if (!inTauri()) {
      return () => {
        disposed = true;
      };
    }

    const captureUnlisten = listen<string>("leetbook://capture", (event) => {
      void ingestCapture(db, event.payload, new Date()).then((result) => {
        if (disposed) return;
        if (result.ok) {
          setLastCapture({
            slug: result.slug,
            title: result.title,
            reviewedAt: result.reviewedAt,
          });
          onIngested(result.slug);
        } else {
          console.warn("[LeetBook] rejected capture:", result.error);
        }
      });
    });
    const queueUnlisten = listen<number>("leetbook://queue-status", (event) => {
      if (!disposed) setQueued(event.payload);
    });

    void invoke<PairingInfo>("get_pairing_info")
      .then((info) => {
        if (!disposed) {
          setPairing(info);
          setPairingError(null);
          setQueued((current) => current ?? (typeof info.queued === "number" ? info.queued : null));
          setListener({
            state: info.listening ? "listening" : "offline",
            port: info.port,
          });
        }
      })
      .catch(() => {
        if (!disposed) {
          setPairingError("The local capture listener could not be reached.");
          setListener({ state: "offline", port: null });
        }
      });

    return () => {
      disposed = true;
      void Promise.all([captureUnlisten, queueUnlisten]).then((unlisteners) => {
        for (const unlisten of unlisteners) unlisten();
      });
    };
  }, [db, onIngested]);

  return { listener, pairing, pairingError, queued, lastCapture };
}
