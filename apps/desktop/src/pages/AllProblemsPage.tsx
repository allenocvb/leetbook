import type { ProblemsView } from "../components/table/ProblemsHeader.js";
import { ProblemsPage } from "./ProblemsPage.js";

export interface AllProblemsPageProps {
  onOpenProblem: (id: string) => void;
  onViewChange?: (view: ProblemsView) => void;
  category?: string | null;
  onCategoryChange?: (category: string | null) => void;
  refreshKey?: unknown;
}

export function AllProblemsPage({
  onOpenProblem,
  onViewChange = () => undefined,
  category = null,
  onCategoryChange = () => undefined,
  refreshKey,
}: AllProblemsPageProps) {
  return (
    <ProblemsPage
      view="all"
      onViewChange={onViewChange}
      onOpenProblem={onOpenProblem}
      category={category}
      onCategoryChange={onCategoryChange}
      refreshKey={refreshKey}
    />
  );
}
