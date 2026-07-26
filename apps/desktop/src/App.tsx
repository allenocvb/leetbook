import type { SqlExecutor } from "@leetbook/core";
import { useState } from "react";
import { AppLayout } from "./components/AppLayout.js";
import { PagePlaceholder } from "./components/PagePlaceholder.js";
import type { ViewId } from "./components/Sidebar.js";
import { DbProvider } from "./db/DbContext.js";
import { useCounts } from "./hooks/useCounts.js";
import { AllProblemsPage } from "./pages/AllProblemsPage.js";
import { DueTodayPage } from "./pages/DueTodayPage.js";
import { ProblemNotesPage } from "./pages/ProblemNotesPage.js";

export function App({ db }: { db: SqlExecutor }) {
  return (
    <DbProvider db={db}>
      <Shell />
    </DbProvider>
  );
}

/** Either a sidebar view or a specific problem's notes page. */
type Route = { view: ViewId } | { view: "problem"; problemId: string; from: ViewId };

function Shell() {
  const [route, setRoute] = useState<Route>({ view: "all-problems" });
  const counts = useCounts(route);

  const activeView = route.view === "problem" ? route.from : route.view;
  const openProblem = (problemId: string) =>
    setRoute({ view: "problem", problemId, from: activeView });

  return (
    <AppLayout
      activeView={activeView}
      onNavigate={(view) => setRoute({ view })}
      counts={{ "all-problems": counts.all, "due-today": counts.due }}
    >
      <Page
        route={route}
        onOpenProblem={openProblem}
        onBack={() => setRoute({ view: activeView })}
      />
    </AppLayout>
  );
}

function Page({
  route,
  onOpenProblem,
  onBack,
}: {
  route: Route;
  onOpenProblem: (id: string) => void;
  onBack: () => void;
}) {
  switch (route.view) {
    case "problem":
      return <ProblemNotesPage problemId={route.problemId} onBack={onBack} />;
    case "all-problems":
      return <AllProblemsPage onOpenProblem={onOpenProblem} />;
    case "due-today":
      return <DueTodayPage onOpenProblem={onOpenProblem} />;
    case "review":
      return <PagePlaceholder title="Review Session" hint="Review queue arrives in Phase 6." />;
    case "capture":
      return <PagePlaceholder title="Capture" hint="Extension capture arrives in Phase 7." />;
    case "settings":
      return <PagePlaceholder title="Settings & Pairing" hint="Pairing arrives in Phase 7." />;
  }
}
