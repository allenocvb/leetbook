import type { SqlExecutor } from "@leetbook/core";
import { useCallback, useState } from "react";
import { useCaptureListener } from "./capture/useCaptureListener.js";
import { AppLayout } from "./components/AppLayout.js";
import { PagePlaceholder } from "./components/PagePlaceholder.js";
import type { ViewId } from "./components/Sidebar.js";
import type { ProblemsView } from "./components/table/ProblemsHeader.js";
import { IntroScreen } from "./components/window/IntroScreen.js";
import { DbProvider } from "./db/DbContext.js";
import { useCounts } from "./hooks/useCounts.js";
import { AllProblemsPage } from "./pages/AllProblemsPage.js";
import { DueTodayPage } from "./pages/DueTodayPage.js";
import { ProblemNotesPage } from "./pages/ProblemNotesPage.js";
import { ReviewSessionPage } from "./pages/ReviewSessionPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

export function App({ db }: { db: SqlExecutor }) {
  return (
    <DbProvider db={db}>
      <Shell />
    </DbProvider>
  );
}

export const FIRST_RUN_STORAGE_KEY = "leetbook.intro.complete";

/** Either the first-run intro, a sidebar view, or a specific problem's notes page. */
type Route =
  | { view: "intro" }
  | { view: ViewId }
  | { view: "problem"; problemId: string; from: ViewId };

function readInitialRoute(): Route {
  try {
    return window.localStorage.getItem(FIRST_RUN_STORAGE_KEY) === "true"
      ? { view: "all-problems" }
      : { view: "intro" };
  } catch {
    return { view: "intro" };
  }
}

function Shell() {
  const [route, setRoute] = useState<Route>(readInitialRoute);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [captureTick, setCaptureTick] = useState(0);
  const listener = useCaptureListener(useCallback(() => setCaptureTick((tick) => tick + 1), []));
  const counts = useCounts({ route, captureTick });

  if (route.view === "intro") {
    const start = () => {
      try {
        window.localStorage.setItem(FIRST_RUN_STORAGE_KEY, "true");
      } catch {
        // Opening the app still works when storage is unavailable.
      }
      setRoute({ view: "all-problems" });
    };

    return <IntroScreen problemCount={counts.all} dueCount={counts.due} onStart={start} />;
  }

  const activeView = route.view === "problem" ? route.from : route.view;
  const openProblem = (problemId: string) =>
    setRoute({ view: "problem", problemId, from: activeView });
  const pickCategory = (category: string) => {
    setActiveCategory((current) => (current === category ? null : category));
    setRoute({ view: activeView === "due-today" ? "due-today" : "all-problems" });
  };

  return (
    <AppLayout
      activeView={activeView}
      onNavigate={(view) => setRoute({ view })}
      counts={{ "all-problems": counts.all, "due-today": counts.due }}
      categories={counts.categories}
      activeCategory={activeCategory}
      onPickCategory={pickCategory}
      listener={listener}
      flushMain={route.view === "all-problems" || route.view === "due-today"}
    >
      <Page
        route={route}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onViewChange={(view) => setRoute({ view: view === "all" ? "all-problems" : "due-today" })}
        onOpenProblem={openProblem}
        onBack={() => setRoute({ view: activeView })}
        onExitReview={() => setRoute({ view: "due-today" })}
      />
    </AppLayout>
  );
}

function Page({
  route,
  activeCategory,
  onCategoryChange,
  onViewChange,
  onOpenProblem,
  onBack,
  onExitReview,
}: {
  route: Route;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onViewChange: (view: ProblemsView) => void;
  onOpenProblem: (id: string) => void;
  onBack: () => void;
  onExitReview: () => void;
}) {
  switch (route.view) {
    case "problem":
      return <ProblemNotesPage problemId={route.problemId} onBack={onBack} />;
    case "all-problems":
      return (
        <AllProblemsPage
          onOpenProblem={onOpenProblem}
          onViewChange={onViewChange}
          category={activeCategory}
          onCategoryChange={onCategoryChange}
        />
      );
    case "due-today":
      return (
        <DueTodayPage
          onOpenProblem={onOpenProblem}
          onViewChange={onViewChange}
          category={activeCategory}
          onCategoryChange={onCategoryChange}
        />
      );
    case "review":
      return <ReviewSessionPage onExit={onExitReview} />;
    case "capture":
      return <PagePlaceholder title="Capture" hint="Extension capture arrives in Phase 7." />;
    case "settings":
      return <SettingsPage />;
  }
}
