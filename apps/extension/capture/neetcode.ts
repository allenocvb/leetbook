/**
 * ⚠️ The ONLY module that knows NeetCode's page internals. When NeetCode changes, this file —
 * and only this file — breaks.
 *
 * Every selector here was read off a live Accepted submission (July 2026), not guessed. The
 * LeetCode adapter cost four wrong rewrites from remembered DOM; see `docs/recon/neetcode.js`
 * for the diagnostic that produced these.
 *
 * NeetCode is an Angular app with no `data-*` hooks, so class names are all we have. They are
 * semantic rather than generated (`problem-title`, not `_ngcontent-abc123`), which is the only
 * reason this is viable at all.
 */

/** Present on the verdict in both the history pane (`h1`) and the console pane (`p`). */
const ACCEPTED_LOCATOR = ".submission-result-accepted";
/** `h1.problem-title` — NeetCode's display title, which matches LeetCode's exactly. */
const TITLE_LOCATOR = "h1.problem-title";
/** The submission header carrying "Memory: 7.7 MB · Time: 28ms · Submitted at: …". */
const SUBMISSION_HEADER_LOCATOR = ".submission-header";
/** Language label above the rendered solution, e.g. "Code | Python". */
const CODE_HEADING_PATTERN = /^\s*Code\s*\|\s*(.+?)\s*$/;

export function isAcceptedResult(root: ParentNode): boolean {
  return root.querySelector(ACCEPTED_LOCATOR) !== null;
}

/**
 * NeetCode's own slug, from `/problems/<slug>` — note it is not the last path segment, which
 * is `history` after a submission.
 *
 * This is deliberately **not** used as the problem's identity. NeetCode renames slugs
 * (`two-integer-sum` for LeetCode's `two-sum`), so identity comes from the title instead;
 * see `leetcodeSlugFromTitle`. This exists to tell problem pages apart from the rest of the
 * site, and for diagnostics.
 */
export function neetcodeSlugFromLocation(href: string): string | null {
  try {
    const match = /\/problems\/([a-z0-9-]+)/i.exec(new URL(href).pathname);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** The problem's display title, which is the field that agrees with LeetCode. */
export function extractTitle(root: ParentNode): string | null {
  const text = root.querySelector(TITLE_LOCATOR)?.textContent?.trim();
  return text ? text : null;
}

/**
 * LeetCode's slugs are slugified titles, so a NeetCode title yields a LeetCode slug directly.
 *
 * This is a guess by construction, and it is never trusted on its own — the caller confirms
 * it by fetching LeetCode's metadata and comparing titles. A wrong guess must cost a skipped
 * capture, never a wrong merge: the app has no way to split two problems back apart once
 * their review histories are combined.
 */
export function leetcodeSlugFromTitle(title: string): string | null {
  const slug = title
    .toLowerCase()
    .trim()
    // Apostrophes vanish rather than becoming separators: "Pascal's Triangle" → pascals-triangle.
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? slug : null;
}

/** Two titles are the same problem if they differ only by punctuation, case or spacing. */
export function titlesAgree(a: string, b: string): boolean {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return normalize(a) === normalize(b);
}

export interface SubmissionStats {
  runtimeMs: number | null;
  memoryMb: number | null;
}

/**
 * Reads "Memory: 7.7 MB · Time: 28ms" from the submission header.
 *
 * Scoped to the header rather than the whole page on purpose: the results pane also shows a
 * runtime distribution chart whose axis labels are times ("24ms", "216ms", "1752ms"), and a
 * document-wide regex happily returns one of those instead.
 */
export function extractStats(root: ParentNode): SubmissionStats {
  const scope = root.querySelector(SUBMISSION_HEADER_LOCATOR) ?? root;
  const text = scope.textContent ?? "";
  const runtime = /Time:\s*([\d.]+)\s*ms/i.exec(text) ?? /([\d.]+)\s*ms/i.exec(text);
  const memory = /Memory:\s*([\d.]+)\s*MB/i.exec(text) ?? /([\d.]+)\s*MB/i.exec(text);
  return {
    runtimeMs: runtime?.[1] ? Number(runtime[1]) : null,
    // Already in MB here — unlike LeetCode's API, which reports raw bytes.
    memoryMb: memory?.[1] ? Number(memory[1]) : null,
  };
}

export interface CodeCapture {
  code: string | null;
  language: string | null;
}

/**
 * Reads the submitted solution out of the DOM.
 *
 * This works on NeetCode and could never work on LeetCode: NeetCode renders the submission as
 * static text under a "Code | Python" heading, whereas LeetCode keeps it in a virtualised
 * Monaco editor that only ever has the visible lines mounted.
 */
export function extractCode(root: ParentNode): CodeCapture {
  for (const heading of root.querySelectorAll("h1, h2, h3, h4, p, div, span")) {
    const match = CODE_HEADING_PATTERN.exec(heading.textContent ?? "");
    // Guard on length: an ancestor containing the heading also matches the pattern, and its
    // text would carry the entire pane rather than the label.
    if (!match?.[1] || (heading.textContent ?? "").length > 40) continue;

    const language = match[1].trim().toLowerCase();
    const code = codeAfter(heading);
    if (code) return { code, language };
    return { code: null, language };
  }
  return { code: null, language: null };
}

/**
 * The rendered solution nearest a "Code | …" label.
 *
 * Prefers a real `<pre>`/`<code>`, which is where the text actually lives, and only then
 * falls back to a sibling block — highlighters sometimes wrap lines in plain divs.
 */
function codeAfter(heading: Element): string | null {
  const container = heading.parentElement ?? heading;
  const block = container.querySelector("pre, code") ?? nextBlock(heading);
  const text = block?.textContent ?? "";
  // A label or a stray word is not a solution; the shortest real one is still far longer.
  return text.trim().length > 20 ? text.replace(/\s+$/, "") : null;
}

function nextBlock(heading: Element): Element | null {
  let sibling = heading.nextElementSibling;
  for (let i = 0; i < 3 && sibling; i++, sibling = sibling.nextElementSibling) {
    if ((sibling.textContent ?? "").trim().length > 20) return sibling;
  }
  return heading.parentElement?.nextElementSibling ?? null;
}
