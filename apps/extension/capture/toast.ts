import type { Difficulty, PerformanceScore } from "@leetbook/core";
import type { CaptureDeliveryResult, QueueFlushResult } from "./delivery.js";
import { detectToastTheme, formatToastMeta, toastButton, toastElement } from "./toastDom.js";
import { CAPTURE_TOAST_STYLES } from "./toastStyles.js";

export interface ToastContent {
  title: string;
  difficulty: Difficulty;
  runtimeMs: number | null;
  memoryMb: number | null;
  codeSaved: boolean;
}

export interface ToastHandlers {
  onRate: (score: PerformanceScore) => Promise<CaptureDeliveryResult>;
}

export interface CaptureToastHandle {
  host: HTMLElement;
  setFlushResult: (result: QueueFlushResult) => void;
}

const SCORES: PerformanceScore[] = [0, 1, 2, 3, 4, 5];

/** Final shadow-DOM capture card. Dismiss and Skip both record score 4 (FSRS Good). */
export function showCaptureToast(
  doc: Document,
  content: ToastContent,
  handlers: ToastHandlers,
): CaptureToastHandle {
  doc.getElementById("leetbook-capture-toast")?.remove();
  const host = doc.createElement("div");
  host.id = "leetbook-capture-toast";
  host.dataset.theme = detectToastTheme(doc);
  const root = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  style.textContent = CAPTURE_TOAST_STYLES;
  const card = toastElement(doc, "section", "card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "LeetBook capture");

  const header = toastElement(doc, "header", "header");
  const logo = toastElement(doc, "span", "logo", "L");
  logo.setAttribute("aria-hidden", "true");
  const dot = toastElement(doc, "span", "dot");
  dot.setAttribute("aria-hidden", "true");
  const status = toastElement(doc, "strong", "status", "Accepted · captured");
  const dismiss = toastButton(doc, "dismiss", "Dismiss and schedule as Good", "×");
  header.append(logo, dot, status, dismiss);

  const title = toastElement(doc, "div", "title", content.title);
  const meta = toastElement(doc, "div", "meta", formatToastMeta(content));
  const prompt = toastElement(doc, "div", "prompt", "Rate your recall");
  const scores = toastElement(doc, "div", "scores");
  scores.setAttribute("aria-label", "Recall score");
  const scoreButtons = SCORES.map((score) => {
    const option = toastButton(doc, "score", `Score ${score}`, String(score));
    option.addEventListener("click", () => void submit(score));
    scores.append(option);
    return option;
  });
  const feedback = toastElement(doc, "div", "feedback");
  feedback.setAttribute("role", "status");
  feedback.hidden = true;
  const skip = toastButton(doc, "skip", "Skip and schedule as Good");
  skip.textContent = "Skip — LeetBook will schedule it as a Good rating.";

  let busy = false;
  let settled = false;

  const disableScores = (disabled: boolean) => {
    for (const option of scoreButtons) option.disabled = disabled;
  };
  const setFeedback = (message: string, tone = "") => {
    feedback.textContent = message;
    feedback.className = `feedback${tone ? ` feedback--${tone}` : ""}`;
    feedback.hidden = false;
  };
  const setQueued = (count: number) => {
    settled = true;
    busy = false;
    status.textContent = `Queued — ${count} waiting`;
    dot.className = "dot dot--queued";
    dismiss.setAttribute("aria-label", "Dismiss");
    prompt.textContent = "Saved locally";
    disableScores(true);
    skip.hidden = true;
    setFeedback("Desktop app offline. LeetBook will retry automatically.");
  };

  async function submit(score: PerformanceScore) {
    if (busy || settled) return;
    busy = true;
    disableScores(true);
    prompt.textContent = "Saving capture…";
    try {
      const result = await handlers.onRate(score);
      if (result.status === "delivered") host.remove();
      else setQueued(result.queued);
    } catch {
      busy = false;
      status.textContent = "Capture needs attention";
      dot.className = "dot dot--error";
      prompt.textContent = "Rate your recall";
      disableScores(false);
      setFeedback("Couldn’t save yet. Check the extension and try again.", "error");
    }
  }

  const dismissAsGood = () => {
    if (!busy && !settled) void handlers.onRate(4).catch(() => undefined);
    host.remove();
  };
  dismiss.addEventListener("click", dismissAsGood);
  skip.addEventListener("click", dismissAsGood);

  card.append(header, title, meta, prompt, scores, feedback, skip);
  root.append(style, card);
  doc.body.append(host);

  return {
    host,
    setFlushResult(result) {
      if (result.remaining > 0) {
        setQueued(result.remaining);
      } else if (result.sent > 0) {
        settled = true;
        status.textContent = "Sent to LeetBook";
        dot.className = "dot dot--sent";
        prompt.textContent = "Capture delivered";
        dismiss.setAttribute("aria-label", "Dismiss");
        disableScores(true);
        skip.hidden = true;
        setFeedback("Queue is clear. This capture reached the desktop app.");
      }
    },
  };
}
