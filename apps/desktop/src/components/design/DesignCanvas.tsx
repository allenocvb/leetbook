import { lazy, Suspense } from "react";
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

export function DesignCanvas(props: ExcalidrawCanvasProps) {
  return (
    <div className="design-canvas">
      <Suspense fallback={<div className="design-canvas__loading">Loading canvas…</div>}>
        <ExcalidrawCanvas {...props} />
      </Suspense>
    </div>
  );
}
