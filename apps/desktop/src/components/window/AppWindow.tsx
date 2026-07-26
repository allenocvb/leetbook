import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar.js";
import "./window.css";

export function AppWindow({ children }: { children: ReactNode }) {
  return (
    <div className="window-stage">
      <section className="app-window" aria-label="LeetBook application">
        <TitleBar />
        <div className="app-window__content">{children}</div>
      </section>
    </div>
  );
}
