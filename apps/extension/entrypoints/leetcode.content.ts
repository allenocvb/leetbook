import {
  extractCode,
  extractStats,
  fetchProblemMeta,
  isAcceptedResult,
  slugFromLocation,
} from "../capture/adapter.js";
import type { CapturePayload } from "../capture/payload.js";
import { showCaptureToast } from "../capture/toast.js";

export default defineContentScript({
  matches: ["*://leetcode.com/*"],
  main() {
    let capturedForSlug: string | null = null;

    const observer = new MutationObserver(() => {
      if (!isAcceptedResult(document)) {
        capturedForSlug = null; // verdict gone → ready for the next submission
        return;
      }
      const slug = slugFromLocation(location.href);
      if (!slug || slug === capturedForSlug) return;
      capturedForSlug = slug;
      void offerCapture(slug);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },
});

async function offerCapture(slug: string): Promise<void> {
  const meta = await fetchProblemMeta(slug);
  if (!meta) return; // metadata unavailable — don't guess

  const stats = extractStats(document);
  const code = extractCode(slug, localStorage);

  const metaParts = [
    meta.difficulty.charAt(0).toUpperCase() + meta.difficulty.slice(1),
    stats.runtimeMs !== null ? `${stats.runtimeMs} ms` : null,
    stats.memoryMb !== null ? `${stats.memoryMb} MB` : null,
    code ? "code saved" : null,
  ].filter(Boolean);

  showCaptureToast(
    document,
    { title: meta.title, meta: metaParts.join(" · ") },
    {
      onRate: (score) => {
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
        void browser.runtime.sendMessage({ type: "leetbook-capture", payload });
      },
      onSkip: () => {},
    },
  );
}
