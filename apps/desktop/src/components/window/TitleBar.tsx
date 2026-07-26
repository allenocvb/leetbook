import { ThemeToggle } from "../ui/ThemeToggle.js";
import "./window.css";

/**
 * The window uses the real macOS controls (`titleBarStyle: "Overlay"`), so this bar draws
 * no buttons of its own — it only reserves space on the left for the ones the system
 * overlays. Drawn circles cannot offer the green button's Move/Resize/Tile menu, which is
 * the whole reason for handing window management back to the OS.
 */
export function TitleBar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <span className="titlebar__name" data-tauri-drag-region>
        LeetBook
      </span>
      <ThemeToggle />
    </header>
  );
}
