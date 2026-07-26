import { useTheme } from "../../theme/ThemeProvider.js";
import "./ui.css";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="ui-theme-toggle"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      aria-pressed={theme === "dark"}
      onClick={toggleTheme}
    >
      <span className="ui-theme-toggle__dot" aria-hidden="true" />
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
