import { useState } from "react";
import { AppLayout } from "./components/AppLayout.js";
import { PagePlaceholder } from "./components/PagePlaceholder.js";
import type { ViewId } from "./components/Sidebar.js";

const PAGES: Record<ViewId, { title: string; hint: string }> = {
  "all-problems": { title: "All Problems", hint: "The table view arrives in 4.3." },
  "due-today": { title: "Due Today", hint: "The due view arrives in 4.5." },
  review: { title: "Review Session", hint: "Review queue arrives in Phase 6." },
  capture: { title: "Capture", hint: "Extension capture arrives in Phase 7." },
  settings: { title: "Settings & Pairing", hint: "Pairing arrives in Phase 7." },
};

export function App() {
  const [view, setView] = useState<ViewId>("all-problems");
  const page = PAGES[view];

  return (
    <AppLayout activeView={view} onNavigate={setView}>
      <PagePlaceholder title={page.title} hint={page.hint} />
    </AppLayout>
  );
}
