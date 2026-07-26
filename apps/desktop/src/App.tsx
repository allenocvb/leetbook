import type { SqlExecutor } from "@leetbook/core";
import { useState } from "react";
import { AppLayout } from "./components/AppLayout.js";
import { PagePlaceholder } from "./components/PagePlaceholder.js";
import type { ViewId } from "./components/Sidebar.js";
import { DbProvider } from "./db/DbContext.js";
import { useCounts } from "./hooks/useCounts.js";
import { AllProblemsPage } from "./pages/AllProblemsPage.js";
import { DueTodayPage } from "./pages/DueTodayPage.js";

export function App({ db }: { db: SqlExecutor }) {
  return (
    <DbProvider db={db}>
      <Shell />
    </DbProvider>
  );
}

function Shell() {
  const [view, setView] = useState<ViewId>("all-problems");
  const counts = useCounts(view);

  return (
    <AppLayout
      activeView={view}
      onNavigate={setView}
      counts={{ "all-problems": counts.all, "due-today": counts.due }}
    >
      <Page view={view} />
    </AppLayout>
  );
}

function Page({ view }: { view: ViewId }) {
  switch (view) {
    case "all-problems":
      return <AllProblemsPage />;
    case "due-today":
      return <DueTodayPage />;
    case "review":
      return <PagePlaceholder title="Review Session" hint="Review queue arrives in Phase 6." />;
    case "capture":
      return <PagePlaceholder title="Capture" hint="Extension capture arrives in Phase 7." />;
    case "settings":
      return <PagePlaceholder title="Settings & Pairing" hint="Pairing arrives in Phase 7." />;
  }
}
