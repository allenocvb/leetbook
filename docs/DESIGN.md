# LeetBook — Design & Architecture Doc

**Status:** Architecture implemented through the v1 foundation; UI fidelity and interaction
recovery are in progress. See `docs/PRD.md` Phase 9 and `docs/UI_SPEC.md`.
**Author:** Allen · July 2026

---

## 1. Problem & Vision

Getting started on LeetCode is hard. Spaced repetition works, but existing tooling is bad at it: Notion tables require manual data entry for every solve, and LeetCode/NeetCode's built-in notes are weak.

**LeetBook** is a minimalist, open-source desktop app for tracking LeetCode progress with spaced repetition and beautiful, Notion-style notes — with a browser extension that removes the manual data entry entirely.

**Vibe:** black-and-white, mostly white, Notion-like, "note-booky." Minimalist. Fast.

**Origin:** replaces a Notion table ("LeetCode Problems Auto") with columns for Status, Next Review, Last Review Date, Performance Score (0–5), Review Count, Category, Difficulty, URL — plus per-problem note pages with code blocks.

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Platform | Desktop app (Tauri 2) + browser extension | Local-first, no servers, no hosting cost — sustainable for free open source |
| Data | Local SQLite + JSON/Markdown export/import | Zero infra; schema designed to be sync-friendly later |
| Scheduling | FSRS (`ts-fsrs`) | Modern, adaptive, open-source; 0–5 UX maps to FSRS ratings |
| Sync/accounts | None in v1 | Local-first is a feature. Append-only review log keeps the door open |
| License | MIT | |

**Performance score rubric (kept from Notion):**

- 0 — Complete blackout, couldn't recall approach or solution
- 1 — Incorrect, but approach felt familiar once seen
- 2 — Incorrect, but knew general approach after a hint/peek
- 3 — Correct, but significant effort or struggle
- 4 — Correct after some hesitation or minor stumbling
- 5 — Perfect recall, solved smoothly and confidently

Internal FSRS mapping: 0–1 → Again, 2 → Hard, 3–4 → Good, 5 → Easy. UX stays 0–5.

## 3. Product Scope (v1)

**Core screens:**

1. **Table view** — the Notion table, but faster/prettier. Columns: Name, Status (derived), Next Review, Last Review, Score, Review Count, Category, Difficulty, URL. Sort/filter. Views: All Problems, Due Today.
2. **Review queue ("Due Today")** — problems due, one-by-one or list; rate 0–5 in-app.
3. **Problem notes page** — Notion-style editor: headings, markdown shortcuts, slash commands, syntax-highlighted code blocks. Problem metadata header (URL, category, difficulty, last review).

**Key principle:** the app is fully usable with manual entry alone. The extension is an automation layer, not a dependency. If LeetCode changes their DOM and capture breaks, the product still works.

**v1 explicitly excludes:** cloud sync, accounts, social features, mobile, editor embeds and databases.

**NeetCode is now in scope (Phase 12).** The original reasoning — that most NeetCode practice
links out to LeetCode anyway — held for the roadmap but not for the user: someone working the
NeetCode 150 in NeetCode's own editor submits there and never touches leetcode.com, so capture
saw nothing. Both sites are first-class sources behind one pipeline (§4.2).

## 4. Architecture

Monorepo with three parts:

```
leetbook/
├── packages/core        # Pure TS, no UI. All business logic.
│   ├── schema + migrations
│   ├── FSRS scheduling (ts-fsrs wrapper)
│   ├── data-access layer
│   └── import/export (Notion CSV, JSON, Markdown)
├── apps/desktop         # Tauri 2 + React. SQLite via Tauri SQL plugin.
└── apps/extension       # Manifest V3, built with WXT. Content scripts on the practice sites.
```

- **Why Tauri over Electron:** ~10MB binaries vs ~150MB, lower memory, enforced UI/system separation.
- **`packages/core` is portable** — a future web version reuses it wholesale.
- **Each site's page knowledge lives in one isolated adapter module** in the extension, with tests. When a site changes, exactly one adapter breaks; keep the blast radius small.

### 4.1 Extension → App Bridge

- Desktop app runs a tiny HTTP listener on `127.0.0.1` (fixed port + one-time pairing token shown in-app).
- Extension POSTs captured submissions to it.
- App not running → extension queues payloads in `chrome.storage`, flushes on next connect.

### 4.2 Capture Flow

Every practice site implements one `CaptureSource` interface (`capture/source.ts`): match a
URL, find the slug, recognise an Accepted verdict, read the metadata, read the submission.
Everything downstream — toast, queue, delivery relay, desktop listener — is source-agnostic.

1. Content script asks the registry which source handles the current page, then watches for
   that source's **Accepted** verdict.
2. The source returns problem metadata (title, difficulty, topics) and the submission itself
   (code, language, runtime, memory).

   The two sites need opposite techniques. On LeetCode both come from GraphQL: the public
   `question` query and the authenticated `submissionDetails` query, keyed by the id LeetCode
   puts in the URL. Scraping was tried and abandoned — the editor buffer is not in
   localStorage, and Monaco virtualises its lines, so DOM capture truncates long solutions.
   DOM stats remain a fallback when there is no id. On NeetCode the reverse holds: the
   submission is rendered as static text and there is no equivalent API, so the DOM is both
   the simplest and the only source.

   NeetCode's metadata lookup runs in the **background worker**. A content script on
   neetcode.io calling leetcode.com is cross-origin and LeetCode sends no permissive
   `Access-Control-Allow-Origin`; the worker holds the host permission and is exempt.
3. In-page toast: "Rate your recall 0–5."
4. Payload sent to app → upsert problem → log review (with code snapshot + perf stats) → FSRS computes next due date.

**Identity is always LeetCode's slug.** A problem solved on NeetCode and the same problem
solved on LeetCode must land on one row, or the review history splits in two and the schedule
stops meaning anything.

NeetCode makes this non-trivial: it renames URL slugs (`two-integer-sum`) but keeps the
displayed title ("Two Sum"). Since LeetCode's slugs are slugified titles, the join is
`slugify(title)` — **then verified** by looking that slug up on LeetCode and confirming the
returned title matches. A mismatch abandons the capture.

The asymmetry is deliberate. A skipped capture is an inconvenience the user can fix by hand; a
wrong merge fuses two problems' review histories and nothing in the app can separate them
again. Fuzzy title matching was rejected for the same reason — "Subarray Sum Equals K" and
"Minimum Size Subarray Sum" are different problems. A shipped 150-row mapping table was
rejected as strictly worse: more to maintain, and no self-check.

### 4.3 Notes Editor

TipTap (ProseMirror) + lowlight code blocks. Notion feel without building an editor. Content stored as JSON; exported as Markdown.

### 4.4 Data Model (sketch)

```
problems    (id, slug, title, url, difficulty, tags[], created_at)
reviews     (id, problem_id, score 0–5, reviewed_at, runtime, memory, code_snapshot)
scheduling  (problem_id, fsrs_stability, fsrs_difficulty, due_at, review_count)
notes       (problem_id, content_json, updated_at)
```

Status and table columns are always **derived**, never stored redundantly. Reviews append during
normal use; the latest score has one explicit correction path that replays scheduling from the
full history. This keeps mistakes recoverable without adding a redundant score field.

## 5. Open Source & Infra

- **Tooling:** pnpm + Turborepo, TypeScript strict, Biome (lint/format), Vitest.
- **CI (GitHub Actions):** every PR → typecheck, unit tests, Rust check, extension build. Release tags → build matrix (macOS/Windows/Linux) via `tauri-action`, publish to GitHub Releases with auto-update.
- **Environments:** no server, so dev/prod = build channels. Dev: `tauri dev` + unpacked extension on dev port. Prod: signed releases.
- **Known costs:** Apple notarization $99/yr (macOS); Chrome Web Store $5 one-time. Windows signing optional at first.
- **Community:** MIT LICENSE, README with demo GIF, CONTRIBUTING.md, issue/PR templates.

## 6. Build Order

1. **Spec + wireframes** — this doc → Claude design phase (table, notes page, review queue, capture toast).
2. **Repo scaffold** — monorepo, tooling, CI skeleton, license.
3. **`packages/core`** — schema, migrations, FSRS wrapper, unit tests. Logic before pixels.
4. **Desktop shell + table view** — Tauri app on SQLite, manual problem add.
5. **Notes editor** — TipTap integration.
6. **Review queue + in-app scoring** — functional foundation complete.
7. **Extension** — capture adapter, localhost bridge, pairing, offline queue.
8. **Import/export** — Notion CSV import (existing 47 problems = test fixture), JSON/Markdown export.
9. **UI fidelity and interaction recovery** — match the final handoff, close authoring/editing
   gaps, and verify Tauri-only behavior.
10. **Packaging polish** — auto-update, signing, store submission.
11. **Launch** — docs, demo GIF, open-source release.

## 7. Risks

| Risk | Mitigation |
|---|---|
| LeetCode DOM/API changes break capture | Isolated adapter module + tests; app fully usable manually |
| MV3 service worker limits | Capture logic in content script; localhost fetch needs host permission |
| Chrome Web Store review delays | Ship desktop app first (usable standalone); extension follows |
| Editor scope creep | Keep the bounded block set in `docs/UI_SPEC.md`; no databases or embeds |
| Sync requests from users | Review history is retained and latest-score correction is explicit; sync remains post-v1 |

## 8. Final UI Contract

The design phase is complete. `docs/UI_SPEC.md` is the final repository-owned contract for
visual design and interaction behavior.

The contract covers the window shell and intro, table and sidebar, notes editor, review session,
extension capture toast, settings/pairing, empty states, import feedback, and light/dark themes.
The original component sketches are references only; production code must retain the real
SQLite/core/extension wiring.
