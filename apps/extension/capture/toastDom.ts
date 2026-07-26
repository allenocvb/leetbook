import type { ToastContent } from "./toast.js";

export function formatToastMeta(content: ToastContent): string {
  return [
    content.difficulty.charAt(0).toUpperCase() + content.difficulty.slice(1),
    content.runtimeMs === null ? "runtime unavailable" : `${content.runtimeMs} ms`,
    content.memoryMb === null ? "memory unavailable" : `${content.memoryMb} MB`,
    content.codeSaved ? "code saved" : "code unavailable",
  ].join(" · ");
}

export function detectToastTheme(doc: Document): "light" | "dark" {
  const html = doc.documentElement;
  if (html.dataset.theme === "dark" || html.classList.contains("dark")) return "dark";
  if (html.dataset.theme === "light") return "light";
  return doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function toastElement(
  doc: Document,
  tag: string,
  className: string,
  text = "",
): HTMLElement {
  const element = doc.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export function toastButton(
  doc: Document,
  className: string,
  label: string,
  text = "",
): HTMLButtonElement {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = className;
  element.setAttribute("aria-label", label);
  element.textContent = text;
  return element;
}
