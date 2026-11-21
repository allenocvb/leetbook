import { lazy, Suspense, useEffect, useState } from "react";
import type { NoteSaveState } from "../../hooks/useNoteAutosave.js";
import type { ExcalidrawCanvasProps } from "./ExcalidrawCanvas.js";
import "./DesignCanvas.css";

/**
 * Excalidraw is roughly a megabyte of JavaScript. Loading it eagerly would make every launch
 * slower for the sake of a feature most sessions never open, so it is fetched the first time
 * a topic's canvas is shown.
 *
 * `docs/perf/bundle-baseline.md` records the entry-chunk size this is protecting; if
 * Excalidraw ever appears there, this indirection has stopped working.
 */
const ExcalidrawCanvas = lazy(() => import("./ExcalidrawCanvas.js"));

export interface DesignCanvasProps extends ExcalidrawCanvasProps {
  /** The canvas autosave's state, shown so the user can see the drawing was kept. */
  saveState?: NoteSaveState;
}

const SAVE_LABEL: Record<NoteSaveState, string> = {
  idle: "Autosaves locally",
  pending: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function DesignCanvas({ saveState = "idle", ...props }: DesignCanvasProps) {
  const [fullScreen, setFullScreen] = useState(false);

  /*
   * Escape leaves full screen. Excalidraw also uses Escape (to drop a selection), and that is
   * fine: both happening at once is what a user pressing Escape in a maximised canvas expects.
   */
  useEffect(() => {
    if (!fullScreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullScreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullScreen]);

  /*
   * Full screen is a class on the same element, never a portal or a second instance:
   * Excalidraw reads its scene once at mount, so remounting it would drop any strokes the
   * autosave has not written yet.
   */
  return (
    <section
      className="design-canvas"
      data-fullscreen={fullScreen || undefined}
      aria-label={fullScreen ? "Diagram, full screen" : "Diagram"}
    >
      <div className="design-canvas__bar">
        <span className="design-canvas__save" data-state={saveState} aria-live="polite">
          {SAVE_LABEL[saveState]}
        </span>
        <button
          type="button"
          className="design-canvas__toggle"
          aria-pressed={fullScreen}
          onClick={() => setFullScreen((open) => !open)}
        >
          {fullScreen ? "Exit full screen · Esc" : "⤢ Full screen"}
        </button>
      </div>
      <div className="design-canvas__surface">
        <Suspense fallback={<div className="design-canvas__loading">Loading canvas…</div>}>
          <ExcalidrawCanvas {...props} />
        </Suspense>
      </div>
    </section>
  );
}
