import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useCallback, useRef } from "react";
import "@excalidraw/excalidraw/index.css";

/**
 * The only module in the app that imports Excalidraw.
 *
 * Kept behind `DesignCanvas` so nothing else names the vendor package: the dependency is
 * large, and a replacement should be a change to this file rather than to every call site.
 * Default-exported because `React.lazy` requires it.
 */

/*
 * Where Excalidraw looks for its font files. Unset, it falls back to fetching them from
 * esm.sh, which fails in a packaged offline app — and never fails during `tauri dev`, because
 * a dev machine has network. `scripts/copy-excalidraw-assets.mjs` puts them here.
 */
if (typeof window !== "undefined") {
  (window as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";
}

export interface ExcalidrawCanvasProps {
  /** Serialized scene, or null for an empty canvas. */
  sceneJson: string | null;
  onChange: (sceneJson: string) => void;
  theme: "light" | "dark";
}

/**
 * Parses a stored scene, trusting Excalidraw's own types for the element shape.
 *
 * The cast is deliberate and contained: elements come straight back out of Excalidraw's
 * `onChange`, so re-deriving their type here would only duplicate a definition that already
 * moves with the package. The `Array.isArray` guard is the part that actually matters.
 */
function parseScene(sceneJson: string | null): ExcalidrawInitialDataState | null {
  if (!sceneJson) return null;
  try {
    const parsed = JSON.parse(sceneJson) as ExcalidrawInitialDataState;
    return Array.isArray(parsed.elements) ? parsed : null;
  } catch {
    // A corrupted scene should cost the diagram, not the whole page.
    return null;
  }
}

export default function ExcalidrawCanvas({ sceneJson, onChange, theme }: ExcalidrawCanvasProps) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  /*
   * Read once. Excalidraw is uncontrolled after mount, so feeding it a new `initialData` on
   * every autosave would reset the scene under the user's cursor mid-stroke.
   */
  const initial = useRef(parseScene(sceneJson));
  const lastSaved = useRef(sceneJson);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>) => {
      /*
       * Only the view state worth restoring is kept. The full appState carries cursor
       * position, selection, collaborators and open menus — none of it belongs in a saved
       * document, and storing it would make every mouse move look like an edit.
       */
      const next = JSON.stringify({
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
      });
      // Excalidraw fires onChange on every pointer move and selection; only real edits save.
      if (next === lastSaved.current) return;
      lastSaved.current = next;
      onChange(next);
    },
    [onChange],
  );

  return (
    <Excalidraw
      excalidrawAPI={(instance) => {
        api.current = instance;
      }}
      initialData={initial.current ?? undefined}
      onChange={handleChange as never}
      theme={theme}
      UIOptions={{
        canvasActions: {
          // The app owns its own persistence and theming; Excalidraw's file menu and theme
          // toggle would offer a second, conflicting source of truth for both.
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: false,
        },
      }}
    />
  );
}
