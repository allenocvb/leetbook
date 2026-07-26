# LeetBook PRD & Task Breakdown

The single source of truth for **what to build next**. Work top-to-bottom, one task at a
time (see `AGENTS.md` for workflow rules). A task is done when it's implemented, tested,
committed, and its box is checked.

`docs/UI_SPEC.md` is the source of truth for visual and interaction acceptance. Historical
Phases 1–8 record functional foundations that exist in the repository; Phase 9 closes the
fidelity, authoring, editing, and desktop-integration gaps found in the July 26, 2026 audit.

## Product summary

LeetBook tracks LeetCode practice with FSRS spaced repetition and Notion-style notes.
Local-first: SQLite on device, no accounts, no servers. A browser extension captures
Accepted submissions so users never retype a problem; the app is fully usable without it.

**Users:** students grinding LeetCode who want honest review scheduling and notes worth rereading.

**The rubric (0–5 recall score, UX-facing; maps internally to FSRS Again/Hard/Good/Easy):**
0 blackout · 1 familiar-after-seeing · 2 knew-approach-after-hint · 3 correct-with-struggle ·
4 correct-with-hesitation · 5 perfect recall

## Non-goals (v1)

No cloud sync, no accounts, no social features, no mobile, no NeetCode-specific capture,
no editor embeds/databases. Local-first is a feature.

---

## Phase 1 — Spec & design ✅

- [x] 1.1 Design doc (`docs/DESIGN.md`)
- [x] 1.2 UI mockups (design deck)

## Phase 2 — Repo scaffold ✅

- [x] 2.1 Monorepo: pnpm + Turborepo + TS strict + Biome + Vitest
- [x] 2.2 Workspaces: `packages/core`, `apps/desktop` (Tauri 2 + React), `apps/extension` (WXT)
- [x] 2.3 CI: lint/typecheck/test/build + cargo check
- [x] 2.4 MIT license, README, GitHub repo

## Phase 3 — packages/core: schema, migrations, FSRS ✅

> Logic before pixels. Everything here is pure TS, fully unit-tested, no Tauri/browser deps.

- [x] 3.1 Domain types: `Problem`, `Review`, `SchedulingState`, `Note` (+ `PerformanceScore` exists)
- [x] 3.2 SQL schema + migration runner (versioned, forward-only migrations; raw SQL strings
      executed through an injected `SqlExecutor` interface so core stays platform-free)
- [x] 3.3 FSRS wrapper around `ts-fsrs`: `scheduleReview(state, score, now) → next state + due date`
- [x] 3.4 Repository layer: problems (upsert by slug), reviews (append-only log), scheduling, notes
- [x] 3.5 Derived views: status (New/Learning/Mastered/Leech), due-today query, table row model
- [x] 3.6 Import: Notion CSV → problems + reviews (use the real 47-problem export as test fixture)
- [x] 3.7 Export: JSON (full) and Markdown (notes)

## Phase 4 — Desktop shell & table view ✅

- [x] 4.1 SQLite wiring: implement `SqlExecutor` with tauri-plugin-sql; run migrations on boot
- [x] 4.2 App layout: sidebar + main pane (per design deck)
- [x] 4.3 Table view: All Problems (sort, filter, category jump)
- [x] 4.4 Manual problem add dialog
- [x] 4.5 Due Today view

## Phase 5 — Notes editor ✅

- [x] 5.1 TipTap editor component (headings, markdown shortcuts, code blocks w/ highlighting)
- [x] 5.2 Problem notes page: metadata header + editor, autosave to `notes`
- [x] 5.3 Code snapshot block (from captured submissions)

## Phase 6 — Review queue functional foundation ✅

- [x] 6.1 Review session UI: one problem at a time, 0–5 rating, rubric visible
- [x] 6.2 Rating applies `scheduleReview` via core `applyReview`; progress + session summary
- [x] 6.3 Keyboard shortcuts (0–5, enter, esc)

## Phase 7 — Extension capture ✅

- [x] 7.1 Capture adapter: detect Accepted, pull slug/title/difficulty/topics/runtime/code (isolated module + tests)
- [x] 7.2 Desktop listener on 127.0.0.1:7749 (pairing token, CORS, capture event → TS ingest)
- [x] 7.3 In-page 0–5 toast (shadow DOM); post payload to app via background relay
- [x] 7.4 Offline queue in extension storage, flush on reconnect (+ 1-min alarm retry)
- [x] 7.5 Settings & Pairing screen in app (listener address + token card)

## Phase 8 — Import/export UI ✅ (done before Phase 7 to unlock real data)

- [x] 8.1 Notion CSV import flow (file picker + result summary with skipped reasons)
- [x] 8.2 JSON/Markdown export buttons (tauri dialog + fs)

## Phase 9 — UI fidelity, interaction & reliability recovery

> Complete strictly top-to-bottom. Each item includes focused tests and visual verification
> against `docs/UI_SPEC.md` at 1280×820 in light and dark themes when applicable.

- [ ] 9.1 Restore the green repository gate: fix the current `node:sqlite` typecheck failure,
      then verify `pnpm lint && pnpm typecheck && pnpm test`
- [ ] 9.2 Design foundation: semantic light/dark CSS tokens, self-hosted Chewy/Quicksand/
      JetBrains Mono fonts, persisted theme, focus styles, and shared primitives
- [ ] 9.3 Window shell and intro: final titlebar/window treatment, theme toggle, first-run
      intro, and flexible behavior beyond the 1280×820 reference size
- [ ] 9.4 Sidebar: final 236px layout, nav states/counts, category counts/filtering, version,
      and truthful extension/listener footer
- [ ] 9.5 Problem table: final header/tabs/grid/rows/chips, full-row navigation, search,
      sorting, category/filter states, density, empty state, and new-problem affordances
- [ ] 9.6 External links: shared Tauri opener integration for table, notes, and review-session
      LeetCode actions, with browser/test fallback and desktop-shell verification
- [ ] 9.7 Problem editing: reuse the problem form to edit title, URL, difficulty, and
      categories from the notes page; keep scheduling fields derived
- [ ] 9.8 Notes page shell: final 720px layout, title and metadata treatment, category chips,
      latest score/reps/runtime, save status, and action placement
- [ ] 9.9 Editor fundamentals: final document typography and spacing, placeholder, headings,
      paragraphs, marks, lists, blockquote, keyboard behavior, autosave, and tests
- [ ] 9.10 Slash commands and callouts: keyboard-operable `/` menu for every supported block
      type, including the final purple-rule recall callout
- [ ] 9.11 Code authoring and snapshots: discoverable code-block insertion, language selection,
      lowlight highlighting, final header/body styling, and consistent read-only snapshots
- [ ] 9.12 Manual review entry: add a 0–5 `Log review` flow from any problem, append the review,
      recompute FSRS, and refresh all derived fields
- [ ] 9.13 Review correction and history: show review history and safely correct the latest
      mistaken review by replaying derived scheduling; never overwrite a redundant score field
- [ ] 9.14 Review session fidelity: final top progress bar, 620px content, score hover/selection
      rubric, FSRS preview, working `Show my notes`, keyboard flow, and summary
- [ ] 9.15 Extension capture fidelity: final bottom-right toast, queued state/count, dismiss,
      skip-as-Good behavior, offline flush feedback, and fixture-page verification
- [ ] 9.16 Desktop Capture view: replace the stale Phase 7 placeholder with real pairing,
      listener, queue, capture-status, and extension-setup information
- [ ] 9.17 Settings & Pairing fidelity: final connection/scheduling/data cards, real status and
      last capture, token regeneration, queued count, daily limit, stats, import, and exports
- [ ] 9.18 Import follow-through: clearer import limitations/results, duplicate handling,
      skipped-row details, and a direct action to view and work with imported problems
- [ ] 9.19 Full visual and integration QA: every view in light/dark at 1280×820, keyboard and
      focus audit, real Tauri external links/file operations, real extension capture path,
      and regression fixes
- [ ] 9.20 UI acceptance evidence: capture final reference screenshots, record known limitations,
      and verify every Phase 9 item against the final visual contract

## Phase 10 — Packaging

- [ ] 10.1 tauri-action release builds + auto-update
- [ ] 10.2 macOS signing/notarization; Chrome Web Store submission

## Phase 11 — Launch

- [ ] 11.1 Launch README with demo GIF, extension setup, CONTRIBUTING.md, and issue templates
- [ ] 11.2 v0.1.0 release
