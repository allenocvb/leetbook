import type { PerformanceScore } from "@leetbook/core";

export interface ToastContent {
  title: string;
  meta: string;
}

export interface ToastHandlers {
  onRate: (score: PerformanceScore) => void;
  onSkip: () => void;
}

/**
 * The in-page capture toast: white card, top-right, 0–5 chips, skip link.
 * Rendered inside a shadow root so LeetCode's styles can't leak in.
 * Returns the host element; it removes itself after a choice.
 */
export function showCaptureToast(
  doc: Document,
  content: ToastContent,
  handlers: ToastHandlers,
): HTMLElement {
  const host = doc.createElement("div");
  host.id = "leetbook-capture-toast";
  const root = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  style.textContent = `
    .card {
      position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      width: 320px; background: #ffffff; color: #111111;
      border: 1px solid #ebebea; border-radius: 10px;
      box-shadow: 0 12px 32px rgba(17, 17, 17, 0.14);
      font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
      padding: 14px 16px;
    }
    .kicker { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #666666; }
    .dot { width: 7px; height: 7px; border-radius: 999px; background: #1a8917; }
    .title { font-weight: 600; margin: 6px 0 2px; }
    .meta { color: #666666; font-size: 12px; }
    .prompt { margin: 12px 0 6px; font-size: 12px; }
    .scores { display: flex; gap: 6px; }
    .scores button {
      flex: 1; height: 30px; font: inherit; cursor: pointer;
      background: #ffffff; border: 1px solid #ebebea; border-radius: 6px;
    }
    .scores button:hover { background: #efeffb; border-color: #5b5bd6; }
    .skip {
      margin-top: 10px; font-size: 11px; color: #666666;
      background: none; border: none; padding: 0; cursor: pointer;
    }
  `;

  const card = doc.createElement("div");
  card.className = "card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "LeetBook capture");

  const kicker = doc.createElement("div");
  kicker.className = "kicker";
  const dot = doc.createElement("span");
  dot.className = "dot";
  kicker.append(dot, doc.createTextNode("Accepted · captured"));

  const title = doc.createElement("div");
  title.className = "title";
  title.textContent = content.title;

  const meta = doc.createElement("div");
  meta.className = "meta";
  meta.textContent = content.meta;

  const prompt = doc.createElement("div");
  prompt.className = "prompt";
  prompt.textContent = "Rate your recall";

  const scores = doc.createElement("div");
  scores.className = "scores";
  for (const score of [0, 1, 2, 3, 4, 5] as PerformanceScore[]) {
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = String(score);
    button.addEventListener("click", () => {
      host.remove();
      handlers.onRate(score);
    });
    scores.append(button);
  }

  const skip = doc.createElement("button");
  skip.type = "button";
  skip.className = "skip";
  skip.textContent = "Skip — don't record this one";
  skip.addEventListener("click", () => {
    host.remove();
    handlers.onSkip();
  });

  card.append(kicker, title, meta, prompt, scores, skip);
  root.append(style, card);
  doc.body.append(host);
  return host;
}
