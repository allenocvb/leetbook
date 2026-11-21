import { useState } from "react";
import { Button } from "../ui/Button.js";
import "./ProblemsPage.css";

export type ProblemsView = "all" | "due";
export type TableDensity = "comfortable" | "compact";

export interface ProblemsHeaderProps {
  view: ProblemsView;
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (query: string) => void;
  category: string | null;
  onClearCategory: () => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  onClearFilters: () => void;
  onViewChange: (view: ProblemsView) => void;
  onNew: () => void;
}

export function ProblemsHeader({
  view,
  title,
  subtitle,
  query,
  onQueryChange,
  category,
  onClearCategory,
  density,
  onDensityChange,
  onClearFilters,
  onViewChange,
  onNew,
}: ProblemsHeaderProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const hasFilters = query.trim() !== "" || category !== null;

  return (
    <header className="problems-header">
      <div className="problems-header__top">
        <div className="problems-header__copy">
          <h1>{title}</h1>
          <div className="problems-header__subtitle">
            <span>{subtitle}</span>
            {category && (
              <button type="button" className="problems-header__chip" onClick={onClearCategory}>
                {category}
                <span aria-hidden="true">×</span>
                <span className="problems-header__sr-only">Clear category filter</span>
              </button>
            )}
          </div>
        </div>

        <div className="problems-header__actions">
          <label className="problems-header__search">
            <span aria-hidden="true">⌕</span>
            <span className="problems-header__sr-only">Search problems</span>
            <input
              type="search"
              aria-label="Search problems"
              placeholder="Search problems"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>

          <div className="problems-header__filter">
            <Button
              variant="outline"
              aria-expanded={optionsOpen}
              aria-controls="table-options"
              onClick={() => setOptionsOpen((open) => !open)}
            >
              Filter{hasFilters ? " ·" : ""}
            </Button>
            {optionsOpen && (
              <div
                id="table-options"
                className="problems-header__options"
                role="dialog"
                aria-label="Table options"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOptionsOpen(false);
                }}
              >
                <p>Row density</p>
                <div className="problems-header__density">
                  {(["comfortable", "compact"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={density === value}
                      onClick={() => {
                        onDensityChange(value);
                        setOptionsOpen(false);
                      }}
                    >
                      {value === "comfortable" ? "Comfortable" : "Compact"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="problems-header__clear"
                  disabled={!hasFilters}
                  onClick={() => {
                    onClearFilters();
                    setOptionsOpen(false);
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <Button onClick={onNew}>+ New problem</Button>
        </div>
      </div>

      <div className="problems-tabs" role="tablist" aria-label="Problem views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "all"}
          onClick={() => onViewChange("all")}
        >
          All Problems
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "due"}
          onClick={() => onViewChange("due")}
        >
          Due Today
        </button>
      </div>
    </header>
  );
}
