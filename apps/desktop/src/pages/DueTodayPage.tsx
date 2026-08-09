import { DueDesignBanner } from "../components/design/DueDesignBanner.js";
import type { ProblemsView } from "../components/table/ProblemsHeader.js";
import { ProblemsPage } from "./ProblemsPage.js";
import "./DueTodayPage.css";

export function DueTodayPage({
  onOpenProblem,
  onViewChange = () => undefined,
  category = null,
  onCategoryChange = () => undefined,
  refreshKey,
  designDue = 0,
  onReviewDesign = () => undefined,
}: {
  onOpenProblem: (id: string) => void;
  onViewChange?: (view: ProblemsView) => void;
  category?: string | null;
  onCategoryChange?: (category: string | null) => void;
  refreshKey?: unknown;
  /** Design topics due, surfaced as a banner rather than mixed into the table. */
  designDue?: number;
  onReviewDesign?: () => void;
}) {
  /*
   * The wrapper is load-bearing. `.problems-page` takes `height: 100%` so its table can
   * scroll under a sticky header; adding a sibling to a plain block parent would leave both
   * fighting for the same 100% and clip the table. A flex column gives the banner its
   * intrinsic height and the page the rest.
   */
  return (
    <div className="due-today-page">
      <DueDesignBanner count={designDue} onReview={onReviewDesign} />
      <ProblemsPage
        view="due"
        onViewChange={onViewChange}
        onOpenProblem={onOpenProblem}
        category={category}
        onCategoryChange={onCategoryChange}
        refreshKey={refreshKey}
      />
    </div>
  );
}
