import type { SqlExecutor } from "@leetbook/core";
import { useCallback, useState } from "react";
import { type CaptureRuntime, useCaptureListener } from "./capture/useCaptureListener.js";
import { AppLayout } from "./components/AppLayout.js";
import type { ViewId } from "./components/Sidebar.js";
import { PairApprovalDialog } from "./components/settings/PairApprovalDialog.js";
import type { ProblemsView } from "./components/table/ProblemsHeader.js";
import { IntroScreen } from "./components/window/IntroScreen.js";
import { DbProvider } from "./db/DbContext.js";
import { useCounts } from "./hooks/useCounts.js";
import { AllProblemsPage } from "./pages/AllProblemsPage.js";
import { DesignTopicNotesPage } from "./pages/DesignTopicNotesPage.js";
import { DesignTopicsPage } from "./pages/DesignTopicsPage.js";
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

/** The launch intro, a sidebar view, or one subject's notes page. */
type Route =
  | { view: "intro" }
  | { view: ViewId }
  | { view: "problem"; problemId: string; from: ViewId }
  | { view: "design-topic"; topicId: string };

function Shell() {
  // The intro is launch behaviour, not first-run: every start lands here, and nothing is
  // persisted. Navigating away within a session does not bring it back.
  const [route, setRoute] = useState<Route>({ view: "intro" });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [captureTick, setCaptureTick] = useState(0);
  const capture = useCaptureListener(useCallback(() => setCaptureTick((tick) => tick + 1), []));
  const counts = useCounts({ route, captureTick });

  if (route.view === "intro") {
    return (
      <IntroScreen
        problemCount={counts.all}
        dueCount={counts.due}
        onStart={() => setRoute({ view: "all-problems" })}
      />
    );
  }

  const activeView =
    route.view === "problem"
      ? route.from
      : route.view === "design-topic"
        ? "system-design"
        : route.view;
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
      listener={capture.listener}
      flushMain={
        route.view === "all-problems" ||
        route.view === "due-today" ||
        route.view === "problem" ||
        route.view === "review" ||
        route.view === "system-design" ||
        route.view === "design-topic" ||
        route.view === "settings"
      }
    >
      {capture.pairPrompt && (
        <PairApprovalDialog prompt={capture.pairPrompt} onResolve={capture.resolvePairing} />
      )}
      <Page
        route={route}
        refreshKey={captureTick}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onViewChange={(view) => setRoute({ view: view === "all" ? "all-problems" : "due-today" })}
        onOpenProblem={openProblem}
        onOpenTopic={(topicId) => setRoute({ view: "design-topic", topicId })}
        onBack={() => setRoute({ view: activeView })}
        onExitReview={() => setRoute({ view: "due-today" })}
        capture={capture}
      />
    </AppLayout>
  );
}

function Page({
  route,
  refreshKey,
  activeCategory,
  onCategoryChange,
  onViewChange,
  onOpenProblem,
  onOpenTopic,
  onBack,
  onExitReview,
  capture,
}: {
  route: Route;
  refreshKey: number;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onViewChange: (view: ProblemsView) => void;
  onOpenProblem: (id: string) => void;
  onOpenTopic: (id: string) => void;
  onBack: () => void;
  onExitReview: () => void;
  capture: CaptureRuntime;
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
          refreshKey={refreshKey}
        />
      );
    case "due-today":
      return (
        <DueTodayPage
          onOpenProblem={onOpenProblem}
          onViewChange={onViewChange}
          category={activeCategory}
          onCategoryChange={onCategoryChange}
          refreshKey={refreshKey}
        />
      );
    case "review":
      return <ReviewSessionPage onExit={onExitReview} onShowNotes={onOpenProblem} />;
    case "system-design":
      return <DesignTopicsPage onOpenTopic={onOpenTopic} refreshKey={refreshKey} />;
    case "design-topic":
      return <DesignTopicNotesPage topicId={route.topicId} onBack={onBack} />;
    case "settings":
      return <SettingsPage capture={capture} onViewProblems={() => onViewChange("all")} />;
  }
}
