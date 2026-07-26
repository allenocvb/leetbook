import { LogoMark } from "./ui/LogoMark.js";
import "./Sidebar.css";

export type ViewId = "all-problems" | "due-today" | "review" | "settings";

export interface NavItem {
  id: ViewId;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "all-problems", label: "All Problems" },
  { id: "due-today", label: "Due Today" },
  { id: "review", label: "Review Session" },
  { id: "settings", label: "Settings & Pairing" },
];

export interface CategoryCount {
  name: string;
  count: number;
}

export interface ListenerSummary {
  state: "checking" | "listening" | "offline";
  port: number | null;
}

export interface SidebarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  counts?: Partial<Record<ViewId, number>>;
  categories?: CategoryCount[];
  activeCategory?: string | null;
  onPickCategory?: (category: string) => void;
  listener?: ListenerSummary;
}

function listenerLabel(state: ListenerSummary["state"]) {
  if (state === "listening") return "Listener ready";
  if (state === "checking") return "Checking listener";
  return "Listener offline";
}

export function Sidebar({
  activeView,
  onNavigate,
  counts = {},
  categories = [],
  activeCategory = null,
  onPickCategory,
  listener = { state: "offline", port: null },
}: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <header className="sidebar__header">
        <LogoMark size={22} />
        <span className="sidebar__brand">LeetBook</span>
        <span className="sidebar__version">v1</span>
      </header>

      <ul className="sidebar__nav-list">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeView;
          const count = counts[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                className="sidebar__nav-item"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
              >
                <span className="sidebar__nav-bullet" aria-hidden="true" />
                <span>{item.label}</span>
                {count !== undefined && (
                  <span
                    className={
                      item.id === "due-today"
                        ? "sidebar__nav-count sidebar__nav-count--due"
                        : "sidebar__nav-count"
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <section className="sidebar__categories" aria-labelledby="category-heading">
        <h2 id="category-heading">Categories</h2>
        <ul>
          {categories.map((category) => {
            const active = activeCategory === category.name;
            return (
              <li key={category.name}>
                <button
                  type="button"
                  className="sidebar__category"
                  aria-pressed={active}
                  onClick={() => onPickCategory?.(category.name)}
                >
                  <span>{category.name}</span>
                  <span className="sidebar__category-count">{category.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="sidebar__footer" role="status" aria-label="Capture listener status">
        <span
          className={`sidebar__listener-dot sidebar__listener-dot--${listener.state}`}
          aria-hidden="true"
        />
        <span>{listenerLabel(listener.state)}</span>
        <span className="sidebar__port">{listener.port === null ? "—" : `:${listener.port}`}</span>
      </div>
    </nav>
  );
}
