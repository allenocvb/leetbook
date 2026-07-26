import { ThemeToggle } from "../ui/ThemeToggle.js";
import "./window.css";

type WindowAction = "close" | "minimize" | "toggleMaximize";

async function runWindowAction(action: WindowAction) {
  if (!("__TAURI_INTERNALS__" in window)) return;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow()[action]();
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
          aria-label="Maximize window"
          onClick={() => void runWindowAction("toggleMaximize")}
        />
      </div>
      <span className="titlebar__name" data-tauri-drag-region>
        LeetBook
      </span>
      <ThemeToggle />
    </header>
  );
}
