import "@fontsource/chewy/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/quicksand/latin-400.css";
import "@fontsource/quicksand/latin-500.css";
import {
  extractCode,
  extractStats,
  fetchProblemMeta,
  isAcceptedResult,
  slugFromLocation,
} from "../capture/adapter.js";
import { isCaptureDeliveryResult, type QueueStatusMessage } from "../capture/delivery.js";
import type { CapturePayload } from "../capture/payload.js";
import { type CaptureToastHandle, showCaptureToast } from "../capture/toast.js";

export default defineContentScript({
  matches: ["*://leetcode.com/*"],
  main() {
    let capturedForSlug: string | null = null;
    let activeToast: CaptureToastHandle | null = null;

    const checkForCapture = () => {
      if (!isAcceptedResult(document)) {
        capturedForSlug = null; // verdict gone → ready for the next submission
        return;
      }
      const slug = slugFromLocation(location.href);
      if (!slug || slug === capturedForSlug) return;
      capturedForSlug = slug;
      void offerCapture(slug).then((toast) => {
        activeToast?.host.remove();
        activeToast = toast;
      });
    };

    const observer = new MutationObserver(checkForCapture);
    observer.observe(document.body, { childList: true, subtree: true });
    checkForCapture();

    browser.runtime.onMessage.addListener((message: unknown) => {
      const status = message as Partial<QueueStatusMessage>;
      if (
        status.type === "leetbook-queue-status" &&
        typeof status.sent === "number" &&
        typeof status.remaining === "number"
      ) {
        activeToast?.setFlushResult({ sent: status.sent, remaining: status.remaining });
      }
    });
  },
});

async function offerCapture(slug: string): Promise<CaptureToastHandle | null> {
  const meta = await fetchProblemMeta(slug);
  if (!meta) return null; // metadata unavailable — don't guess

  const stats = extractStats(document);
  const code = extractCode(slug, localStorage);
  const sendScore = async (score: CapturePayload["score"]) => {
    const payload: CapturePayload = {
      version: 1,
      slug,
      title: meta.title,
      difficulty: meta.difficulty,
      tags: meta.tags,
      score,
      runtimeMs: stats.runtimeMs,
      memoryMb: stats.memoryMb,
      language: code?.language ?? null,
      codeSnapshot: code?.code ?? null,
      capturedAt: new Date().toISOString(),
    };
    const result: unknown = await browser.runtime.sendMessage({
      type: "leetbook-capture",
      payload,
    });
    if (!isCaptureDeliveryResult(result)) throw new Error("Missing capture delivery result");
    return result;
  };

  return showCaptureToast(
    document,
    {
      title: meta.title,
      difficulty: meta.difficulty,
      runtimeMs: stats.runtimeMs,
      memoryMb: stats.memoryMb,
      codeSaved: code !== null,
    },
    { onRate: sendScore },
  );
}
