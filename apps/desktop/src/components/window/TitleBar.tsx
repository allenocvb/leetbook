import { ThemeToggle } from "../ui/ThemeToggle.js";
import "./window.css";

type WindowAction = "close" | "minimize";

async function runWindowAction(action: WindowAction) {
  if (!("__TAURI_INTERNALS__" in window)) return;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow()[action]();
}

/**
 * The green control enters real fullscreen, not zoom. Maximizing only grows the window,
 * which leaves the macOS menu bar and Dock on screen; fullscreen is what hides them.
 * Double-clicking the titlebar drag region still zooms, matching platform convention.
 */
async function toggleFullscreen() {
  if (!("__TAURI_INTERNALS__" in window)) return;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const appWindow = getCurrentWindow();
  await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
}

export function TitleBar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__traffic-lights">
        <button
          type="button"
          aria-label="Close window"
          onClick={() => void runWindowAction("close")}
        />
        <button
          type="button"
          aria-label="Minimize window"
          onClick={() => void runWindowAction("minimize")}
        />
        <button
          type="button"
          aria-label="Toggle full screen"
          onClick={() => void toggleFullscreen()}
        />
      </div>
      <span className="titlebar__name" data-tauri-drag-region>
        LeetBook
      </span>
      <ThemeToggle />
    </header>
  );
}
