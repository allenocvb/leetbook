import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
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

/** A waiting request from an extension, with the code it is also showing the user. */
export interface PairPrompt {
  id: string;
  code: string;
}

export interface CaptureRuntime {
  listener: ListenerSummary;
  pairing: PairingInfo | null;
  pairingError: string | null;
  queued: number | null;
  lastCapture: LastCapture | null;
  regenerateToken: () => Promise<boolean>;
  /** Non-null while an extension is waiting for the user to approve it. */
  pairPrompt: PairPrompt | null;
  resolvePairing: (approve: boolean) => Promise<void>;
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
  const [pairPrompt, setPairPrompt] = useState<PairPrompt | null>(null);

  const resolvePairing = useCallback(
    async (approve: boolean) => {
      if (!inTauri() || !pairPrompt) return;
      try {
        await invoke("resolve_pair_request", { id: pairPrompt.id, approve });
      } catch {
        // The request expired or was superseded; dropping the prompt is the right outcome.
      }
      setPairPrompt(null);
    },
    [pairPrompt],
  );
  const regenerateToken = useCallback(async () => {
    if (!inTauri()) {
      setPairingError("Pairing is available in the desktop app.");
      return false;
    }
    try {
      const info = await invoke<PairingInfo>("regenerate_pairing_token");
      setPairing(info);
      setPairingError(null);
      setQueued(typeof info.queued === "number" ? info.queued : null);
      setListener({ state: info.listening ? "listening" : "offline", port: info.port });
      return true;
    } catch {
      setPairingError("The extension could not be disconnected.");
      return false;
    }
  }, []);

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
    const pairUnlisten = listen<PairPrompt>("leetbook://pair-request", (event) => {
      if (!disposed) setPairPrompt(event.payload);
    });

    // Catches a request made while the app was starting, before the listener attached.
    void invoke<PairPrompt | null>("pending_pair_request")
      .then((prompt) => {
        if (!disposed && prompt) setPairPrompt(prompt);
      })
      .catch(() => undefined);

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
      void Promise.all([captureUnlisten, queueUnlisten, pairUnlisten]).then((unlisteners) => {
        for (const unlisten of unlisteners) unlisten();
      });
    };
  }, [db, onIngested]);

  return {
    listener,
    pairing,
    pairingError,
    queued,
    lastCapture,
    regenerateToken,
    pairPrompt,
    resolvePairing,
  };
}
