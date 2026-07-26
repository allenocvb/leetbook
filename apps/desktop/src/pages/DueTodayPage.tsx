import type { ProblemsView } from "../components/table/ProblemsHeader.js";
import { ProblemsPage } from "./ProblemsPage.js";

export function DueTodayPage({
  onOpenProblem,
  onViewChange = () => undefined,
  category = null,
  onCategoryChange = () => undefined,
  refreshKey,
}: {
  onOpenProblem: (id: string) => void;
  onViewChange?: (view: ProblemsView) => void;
  category?: string | null;
  onCategoryChange?: (category: string | null) => void;
  refreshKey?: unknown;
}) {
  return (
    <ProblemsPage
      view="due"
      onViewChange={onViewChange}
      onOpenProblem={onOpenProblem}
      category={category}
      onCategoryChange={onCategoryChange}
      refreshKey={refreshKey}
    />
  );
}
