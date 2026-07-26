import "@fontsource/chewy/latin-400.css";
import "@fontsource/quicksand/latin-400.css";
import "@fontsource/quicksand/latin-500.css";
import "@fontsource/quicksand/latin-600.css";
import "@fontsource/quicksand/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "./AppRoot.js";
import { AppWindow } from "./components/window/AppWindow.js";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import "./theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AppWindow>
        <AppRoot />
      </AppWindow>
    </ThemeProvider>
  </StrictMode>,
);
