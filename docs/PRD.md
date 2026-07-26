# LeetBook PRD & Task Breakdown

The single source of truth for **what to build next**. Work top-to-bottom, one task at a
time (see `AGENTS.md` for workflow rules). A task is done when it's implemented, tested,
committed, and its box is checked.

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
- [x] 4.4 Manual problem add/edit dialog (add; editing lands with the notes page header in 5.2)
- [x] 4.5 Due Today view

## Phase 5 — Notes editor

- [ ] 5.1 TipTap editor component (headings, markdown shortcuts, code blocks w/ highlighting)
- [ ] 5.2 Problem notes page: metadata header + editor, autosave to `notes`
- [ ] 5.3 Code snapshot block (from captured submissions)

## Phase 6 — Review queue ⭐ first shippable

- [ ] 6.1 Review session UI: one problem at a time, 0–5 rating, rubric visible
- [ ] 6.2 Rating applies `scheduleReview`; progress + session summary
- [ ] 6.3 Keyboard shortcuts (0–5, enter, esc)

## Phase 7 — Extension capture

- [ ] 7.1 Capture adapter: detect Accepted, pull slug/title/difficulty/topics/runtime/code (isolated module + tests)
- [ ] 7.2 Desktop listener on 127.0.0.1 (fixed port + pairing token)
- [ ] 7.3 In-page 0–5 toast; post payload to app
- [ ] 7.4 Offline queue in extension storage, flush on reconnect
- [ ] 7.5 Settings & Pairing screen in app

## Phase 8 — Import/export UI

- [ ] 8.1 Notion CSV import flow (file picker + preview + result)
- [ ] 8.2 JSON/Markdown export buttons

## Phase 9 — Packaging

- [ ] 9.1 tauri-action release builds + auto-update
- [ ] 9.2 macOS signing/notarization; Chrome Web Store submission

## Phase 10 — Launch

- [ ] 10.1 README with demo GIF, CONTRIBUTING.md, issue templates
- [ ] 10.2 v0.1.0 release
