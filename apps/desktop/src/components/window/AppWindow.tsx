import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar.js";
import "./window.css";

/**
 * The app shell. The window is decorated, so macOS owns its corners, shadow and controls;
 * this only fills it.
 */
export function AppWindow({ children }: { children: ReactNode }) {
  return (
    <section className="app-window" aria-label="LeetBook application">
      <TitleBar />
      <div className="app-window__content">{children}</div>
    </section>
  );
}
