export type ViewId = "all-problems" | "due-today" | "review" | "capture" | "settings";

export interface NavItem {
  id: ViewId;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "all-problems", label: "All Problems" },
  { id: "due-today", label: "Due Today" },
  { id: "review", label: "Review Session" },
  { id: "capture", label: "Capture (extension)" },
  { id: "settings", label: "Settings & Pairing" },
];

export interface SidebarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  /** e.g. { "all-problems": 47, "due-today": 5 } — omitted ids show no badge. */
  counts?: Partial<Record<ViewId, number>>;
}

export function Sidebar({ activeView, onNavigate, counts = {} }: SidebarProps) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: 240,
        flexShrink: 0,
        height: "100%",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 8px 16px",
          fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--text)",
            color: "var(--bg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
          }}
        >
          L
        </span>
        LeetBook
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeView;
          const count = counts[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 8px",
                  borderRadius: 6,
                  color: active ? "var(--accent)" : "var(--text)",
                  background: active ? "#efeffb" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {item.label}
                {count !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      color: active ? "var(--bg)" : "var(--text-secondary)",
                      background: active ? "var(--accent)" : "transparent",
                      borderRadius: 999,
                      minWidth: 18,
                      textAlign: "center",
                      padding: "1px 5px",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
