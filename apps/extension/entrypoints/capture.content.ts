import "@fontsource/chewy/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/rubik/latin-400.css";
import "@fontsource/rubik/latin-500.css";
import { isCaptureDeliveryResult, type QueueStatusMessage } from "../capture/delivery.js";
import type { CapturePayload } from "../capture/payload.js";
import { type CaptureSource, sourceForUrl } from "../capture/source.js";
import { type CaptureToastHandle, showCaptureToast } from "../capture/toast.js";

export default defineContentScript({
  // One script for both sites; which one it is gets resolved per check, below.
  matches: ["*://leetcode.com/*", "*://neetcode.io/*"],
  main() {
    let capturedForSlug: string | null = null;
    let activeToast: CaptureToastHandle | null = null;

    const checkForCapture = () => {
      // Resolved per check, not once at startup: a single-page app can navigate between
      // hosts without the content script being torn down and re-injected.
      const source = sourceForUrl(location.href);
      if (!source) return;

      if (!source.isAccepted(document)) {
        capturedForSlug = null; // verdict gone → ready for the next submission
        return;
      }
      const slug = source.slugFrom(location.href, document);
      if (!slug || slug === capturedForSlug) return;
      capturedForSlug = slug;
      void offerCapture(source, slug).then((toast) => {
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

/** Prefix so a user glancing at the console can tell these apart from LeetCode's own logs. */
const LOG = "[LeetBook]";

async function offerCapture(
  source: CaptureSource,
  slug: string,
): Promise<CaptureToastHandle | null> {
  const meta = await source.readMeta(slug, document);
  if (!meta) {
    /*
     * Bailing is deliberate — difficulty and topics cannot be invented, and on NeetCode a
     * null here also means the title check disagreed, so capturing anyway would merge this
     * submission into some other problem's history. Silence would be indistinguishable from
     * a broken extension, so say which it was.
     */
    console.warn(
      `${LOG} No toast: could not confirm "${slug}" on ${source.name}. Either LeetCode has no such problem, or its title did not match this page. The submission was not captured.`,
    );
    return null;
  }

  const submission = await source.readSubmission(location.href, document);
  if (submission.warning) {
    console.warn(`${LOG} Capturing "${slug}" without a code snapshot: ${submission.warning}.`);
  }
  const { runtimeMs, memoryMb } = submission;
  const sendScore = async (score: CapturePayload["score"]) => {
    const payload: CapturePayload = {
      version: 1,
      slug,
      title: meta.title,
      difficulty: meta.difficulty,
      tags: meta.tags,
      score,
      runtimeMs,
      memoryMb,
      language: submission.language,
      codeSnapshot: submission.code,
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
      runtimeMs,
      memoryMb,
      codeSaved: submission.code != null,
    },
    { onRate: sendScore },
  );
}
