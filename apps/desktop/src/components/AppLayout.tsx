import type { ReactNode } from "react";
import { Sidebar, type SidebarProps } from "./Sidebar.js";

export interface AppLayoutProps extends SidebarProps {
  children: ReactNode;
}

/** Sidebar + main pane shell. All pages render inside the main pane. */
export function AppLayout({ children, ...sidebar }: AppLayoutProps) {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar {...sidebar} />
      <main style={{ flex: 1, overflow: "auto", padding: 32 }}>{children}</main>
    </div>
  );
}
