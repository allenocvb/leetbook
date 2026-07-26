import type { ReactNode } from "react";
import { Sidebar, type SidebarProps } from "./Sidebar.js";
import "./AppLayout.css";

export interface AppLayoutProps extends SidebarProps {
  children: ReactNode;
}

/** Sidebar + main pane shell. All pages render inside the main pane. */
export function AppLayout({ children, ...sidebar }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar {...sidebar} />
      <main className="app-layout__main">{children}</main>
    </div>
  );
}
