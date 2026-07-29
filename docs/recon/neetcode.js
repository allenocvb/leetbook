/*
 * NeetCode capture reconnaissance — PRD 12.2.
 *
 * Paste into the devtools console on a NeetCode problem page. Nothing here touches the page:
 * it reads the DOM, wraps fetch/XHR to log, and prints what it finds.
 *
 * Run STEP 1 before submitting, solve and submit, then run STEP 2. Copy both outputs back.
 *
 * Why two steps: the LeetCode adapter was rewritten four times from guessed DOM selectors,
 * and the answer turned out to be a network call — the code was never in the DOM or in
 * localStorage at all. Step 1 exists so we see the network first this time.
 */

// ─── STEP 1 ── run this BEFORE you hit Submit ────────────────────────────────
(() => {
  const seen = [];
  window.__lb = { seen };

  const interesting = (url) => !/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|map)(\?|$)/i.test(url);

  const record = (method, url, status, body) => {
    if (!interesting(url)) return;
    seen.push({
      method,
      url: String(url).slice(0, 200),
      status,
      // Bodies can be large; a prefix is enough to tell what shape they are.
      body: typeof body === "string" ? body.slice(0, 400) : null,
    });
  };

  const realFetch = window.fetch;
  window.fetch = async function (...args) {
    const request = args[0];
    const url = typeof request === "string" ? request : (request?.url ?? "");
    const method = args[1]?.method ?? request?.method ?? "GET";
    const response = await realFetch.apply(this, args);
    // Clone so the page still gets to read its own response.
    response
      .clone()
      .text()
      .then((text) => record(method, url, response.status, text))
      .catch(() => record(method, url, response.status, null));
    return response;
  };

  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener("load", () => {
      let text = null;
      try {
        text = this.responseText;
      } catch {
        /* opaque response type */
      }
      record(method, url, this.status, text);
    });
    return realOpen.call(this, method, url, ...rest);
  };

  console.log(
    "%c[LB recon] Step 1 armed. Now solve and submit, wait for the verdict, then run Step 2.",
    "color:#6d4aff;font-weight:bold",
  );
})();

// ─── STEP 2 ── run this AFTER the Accepted verdict appears ───────────────────
(() => {
  const out = {};

  // 1. Where are we? The URL is how a source identifies the problem.
  out.location = {
    href: location.href,
    host: location.host,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  };

  // 2. What on screen says the submission passed?
  const VERDICT = /\b(accepted|success|passed|all tests? passed|correct)\b/i;
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    class: el.className?.toString().slice(0, 120) ?? "",
    id: el.id || null,
    data: Object.fromEntries(
      [...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => [a.name, a.value]),
    ),
  });

  // Deepest matches only: a parent containing the verdict text is not the verdict element.
  const verdictNodes = [...document.querySelectorAll("body *")].filter((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(" ");
    return VERDICT.test(own) && own.length < 60;
  });

  out.verdictCandidates = verdictNodes.slice(0, 6).map((el) => ({
    text: el.textContent.trim().slice(0, 60),
    ...describe(el),
    // How far up before stats appear — the LeetCode fix hinged on exactly this number.
    ancestors: (() => {
      const chain = [];
      let node = el.parentElement;
      for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
        chain.push({ level: i + 1, ...describe(node) });
      }
      return chain;
    })(),
  }));

  // 3. Does NeetCode report runtime and memory at all? It may simply not.
  const bodyText = document.body.innerText;
  out.stats = {
    msMatches: [...bodyText.matchAll(/([\d.]+)\s*ms\b/gi)].slice(0, 5).map((m) => m[0]),
    mbMatches: [...bodyText.matchAll(/([\d.]+)\s*MB\b/gi)].slice(0, 5).map((m) => m[0]),
    percentMatches: [...bodyText.matchAll(/([\d.]+)\s*%/g)].slice(0, 5).map((m) => m[0]),
  };

  // 4. Is the solution reachable without scraping a virtualised editor?
  out.editor = {
    hasMonaco: typeof window.monaco !== "undefined",
    monacoModels:
      typeof window.monaco !== "undefined"
        ? window.monaco.editor.getModels().map((m) => ({
            language: m.getLanguageId?.() ?? null,
            lines: m.getLineCount(),
            chars: m.getValue().length,
            head: m.getValue().slice(0, 80),
          }))
        : null,
    hasCodeMirror: !!document.querySelector(".cm-editor, .CodeMirror"),
    aceElements: document.querySelectorAll(".ace_editor").length,
  };

  // 5. Is anything cached locally? On LeetCode this was a dead end; worth ruling out.
  const slugGuess = location.pathname.split("/").filter(Boolean).pop() ?? "";
  out.storage = {
    slugGuess,
    localKeysMentioningSlug: Object.keys(localStorage).filter((k) =>
      k.toLowerCase().includes(slugGuess.toLowerCase()),
    ),
    localKeysLookingLikeCode: Object.keys(localStorage).filter((k) =>
      /code|lang|solution|editor|submission/i.test(k),
    ),
    localKeySample: Object.keys(localStorage).slice(0, 25),
    sessionKeySample: Object.keys(sessionStorage).slice(0, 25),
  };

  // 6. The network. This is the part most likely to hold the answer.
  const captured = window.__lb?.seen ?? [];
  out.network = {
    armed: captured.length > 0,
    // Anything that smells like the app's own backend rather than assets or analytics.
    apiCalls: captured.filter((r) => /api|graphql|submi|run|judge|execute/i.test(r.url)).slice(-15),
    totalCaptured: captured.length,
  };
  // Resource timings survive even if Step 1 was skipped — a weaker but useful fallback.
  out.resourceHints = performance
    .getEntriesByType("resource")
    .filter((e) => /api|graphql|submi|judge|execute/i.test(e.name))
    .slice(-15)
    .map((e) => e.name.slice(0, 160));

  // 7. Does NeetCode point at LeetCode? If a LeetCode URL is on the page, slug mapping is free.
  out.leetcodeLinks = [...document.querySelectorAll('a[href*="leetcode.com"]')]
    .slice(0, 5)
    .map((a) => a.getAttribute("href"));

  console.log("%c[LB recon] Step 2 results", "color:#6d4aff;font-weight:bold");
  console.log(out);
  // Structured, copyable, and safe to paste — no cookies, tokens or auth headers are read.
  console.log(JSON.stringify(out, null, 2));
})();

// ─── STEP 3 ── the two questions Step 2 left open ────────────────────────────
/*
 * Step 2 answered the DOM. It did not answer:
 *
 *   a) Where does the submitted code live? NeetCode uses neither Monaco nor CodeMirror by
 *      the usual globals, and every API call goes through one Firebase callable endpoint
 *      (`/api/callableFunctionHttp`), so the method name is inside the request body.
 *   b) How do we get from `two-integer-sum` to LeetCode's `two-sum`? They are the same
 *      problem and must share one row, but NeetCode renames problems and the history page
 *      links nowhere. If NeetCode knows LeetCode's identifier anywhere, this finds it.
 *
 * Run on the same tab as Step 2 — the captured calls are still in `window.__lb`. If you have
 * reloaded since, re-run Step 1, submit again, then run this.
 */
(() => {
  const out = {};
  const captured = window.__lb?.seen ?? [];

  // (a) Every call, in full, with the body prefix that names the callable being invoked.
  out.calls = captured.map((r) => ({
    method: r.method,
    url: r.url,
    status: r.status,
    body: r.body,
  }));
  out.callsCaptured = captured.length;
  out.stillArmed = !!window.__lb;

  // Which editor is actually mounted, by looking for its DOM rather than its global.
  const editorish = [...document.querySelectorAll("body *")]
    .filter((el) => /editor|monaco|codemirror|ace_|cm-/i.test(el.className?.toString() ?? ""))
    .slice(0, 12);
  out.editorElements = editorish.map((el) => ({
    tag: el.tagName.toLowerCase(),
    class: el.className.toString().slice(0, 100),
    textLength: el.textContent.length,
  }));

  // (b) Anything anywhere that mentions LeetCode — a mapping table would be ideal.
  const html = document.documentElement.innerHTML;
  const mentions = [...html.matchAll(/.{80}leetcode.{80}/gi)].slice(0, 6).map((m) => m[0]);
  out.leetcodeMentionsInHtml = mentions;
  out.leetcodeInStorage = Object.entries(localStorage)
    .filter(([k, v]) => /leetcode/i.test(k) || /leetcode/i.test(v ?? ""))
    .slice(0, 5)
    .map(([k, v]) => [k, String(v).slice(0, 200)]);

  // The problem's own title, which is the one field that does match LeetCode.
  out.headings = [...document.querySelectorAll("h1, h2, .title, [class*=title]")]
    .map((el) => el.textContent.trim())
    .filter((text) => text && text.length < 60)
    .slice(0, 10);

  console.log("%c[LB recon] Step 3 results", "color:#6d4aff;font-weight:bold");
  console.log(out);
  try {
    copy(JSON.stringify(out, null, 2)); // devtools helper: puts it straight on the clipboard
    console.log("%cCopied to clipboard.", "color:#3d7a52");
  } catch {
    console.log(JSON.stringify(out, null, 2));
  }
})();
