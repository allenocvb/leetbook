import { type ReactNode, useEffect, useState } from "react";
import { TitleBar } from "./TitleBar.js";
import "./window.css";

/**
 * Tracks fullscreen so the shell can drop its corner radius. The window is transparent,
 * so rounded corners in fullscreen would punch holes at the edges of the display.
 */
function useIsFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let active = true;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      const sync = async () => {
        const value = await appWindow.isFullscreen();
        if (active) setFullscreen(value);
      };

      await sync();
      const stop = await appWindow.onResized(() => void sync());
      if (active) unlisten = stop;
      else stop();
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return fullscreen;
}

/** The app shell. Fills the OS window and owns the window's corner radius. */
export function AppWindow({ children }: { children: ReactNode }) {
  const fullscreen = useIsFullscreen();

  return (
    <section
      className="app-window"
      aria-label="LeetBook application"
      data-fullscreen={fullscreen ? "true" : undefined}
    >
      <TitleBar />
      <div className="app-window__content">{children}</div>
    </section>
  );
}
