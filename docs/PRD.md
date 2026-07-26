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

- [x] 9.1 Restore the green repository gate: fix the current `node:sqlite` typecheck failure,
      then verify `pnpm lint && pnpm typecheck && pnpm test`
- [x] 9.2 Design foundation: semantic light/dark CSS tokens, self-hosted Chewy/Quicksand/
      JetBrains Mono fonts, persisted theme, focus styles, and shared primitives
- [x] 9.3 Window shell and intro: final titlebar/window treatment, theme toggle, first-run
      intro, and flexible behavior beyond the 1280×820 reference size
- [x] 9.4 Sidebar: final 236px layout, nav states/counts, category counts/filtering, version,
      and truthful extension/listener footer
- [x] 9.5 Problem table: final header/tabs/grid/rows/chips, full-row navigation, search,
      sorting, category/filter states, density, empty state, and new-problem affordances
- [x] 9.6 External links: shared Tauri opener integration for notes and review-session
      LeetCode actions, with browser/test fallback and desktop-shell verification; table rows
      remain notes navigation with decorative arrows per the UI contract
- [x] 9.7 Problem editing: reuse the problem form to edit title, URL, difficulty, and
      categories from the notes page; keep scheduling fields derived
- [x] 9.8 Notes page shell: final 720px layout, title and metadata treatment, category chips,
      latest score/reps/runtime, save status, and action placement
- [x] 9.9 Editor fundamentals: final document typography and spacing, placeholder, headings,
      paragraphs, marks, lists, blockquote, keyboard behavior, autosave, and tests
- [x] 9.10 Slash commands and callouts: keyboard-operable `/` menu for every supported block
      type, including the final purple-rule recall callout
- [x] 9.11 Code authoring and snapshots: discoverable code-block insertion, language selection,
      lowlight highlighting, final header/body styling, and consistent read-only snapshots
- [x] 9.12 Manual review entry: add a 0–5 `Log review` flow from any problem, append the review,
      recompute FSRS, and refresh all derived fields
- [x] 9.13 Review correction and history: show review history and safely correct the latest
      mistaken review by replaying derived scheduling; never overwrite a redundant score field
- [x] 9.14 Review session fidelity: final top progress bar, 620px content, score hover/selection
      rubric, FSRS preview, working `Show my notes`, keyboard flow, and summary
- [x] 9.15 Extension capture fidelity: final bottom-right toast, queued state/count, dismiss,
      skip-as-Good behavior, offline flush feedback, and fixture-page verification
- [x] 9.16 Desktop Capture view: replace the stale Phase 7 placeholder with real pairing,
      listener, queue, capture-status, and extension-setup information
- [x] 9.17 Settings & Pairing fidelity: final connection/scheduling/data cards, real status and
      last capture, token regeneration, queued count, daily limit, stats, import, and exports
- [x] 9.18 Import follow-through: clearer import limitations/results, duplicate handling,
      skipped-row details, and a direct action to view and work with imported problems
- [x] 9.19 Full visual and integration QA: every view in light/dark at 1280×820, keyboard and
      focus audit, real Tauri external links/file operations, real extension capture path,
      and regression fixes
- [x] 9.20 Window shell correction: remove the simulated desk frame so the app fills the OS
      window edge to edge, grant `core:window:allow-start-dragging` so the titlebar actually
      drags, round the window via a transparent Tauri window, make the green control enter
      real fullscreen so the menu bar hides, give the traffic lights a muted red/amber/green
      hover, and fix the `docs/UI_SPEC.md` line that described the handoff deck's slide
      framing as app layout
- [x] 9.21 Scroll and editor interaction fixes: give the problems page an explicit height so
      the table scrolls under its sticky header, sync slash-menu hover with the active index,
      stop the menu from scrolling the notes page, and drop the full-document focus ring
- [x] 9.22 Code block authoring: replace the React code-block node view with a plain DOM one so
      a newly inserted block can hold the caret, keep Tab in the block as indentation, add
      Shift-Tab outdent and indentation-preserving Enter, and stop `/` opening the slash menu
      inside code
- [x] 9.23 Problem deletion: remove a problem and all derived records from the notes page with
      an inline confirm, cancel autosave first so the note is not recreated, and delete children
      explicitly rather than relying on a foreign-key cascade the app connection does not enable
- [ ] 9.24 UI acceptance evidence: capture final reference screenshots, record known limitations,
      and verify every Phase 9 item against the final visual contract

## Phase 10 — Packaging

> **Sequencing open.** If the web build (Phase 12) becomes the primary surface, macOS
> notarization ($99/yr) and Chrome Web Store submission may be money and effort spent on a
> secondary target. Decide whether to defer this phase behind Phase 12 before starting it.

- [ ] 10.1 tauri-action release builds + auto-update
- [ ] 10.2 macOS signing/notarization; Chrome Web Store submission

## Phase 11 — Launch

- [ ] 11.1 Launch README with demo GIF, extension setup, CONTRIBUTING.md, and issue templates
- [ ] 11.2 v0.1.0 release

## Phase 12 — Web app (local-first in the browser)

> Feasible because the architecture held: `packages/core` is 1,330 lines with one
> dependency (`ts-fsrs`) and reaches storage only through `SqlExecutor`, and just six
> modules in `apps/desktop` touch Tauri. Everything else ports unchanged.
>
> Stays local-first — no accounts, no server, `$0` hosting. Phase 13 keeps the door open
> for sync without committing to it. Desktop remains the better capture path meanwhile,
> so both ship from this monorepo against the same core.

- [ ] 12.1 `importDatabaseJson` in core, matching the existing versioned
      `exportDatabaseJson`. Export was written for migration; the other half never was,
      and it is the only way to move existing desktop data into the web build.
- [ ] 12.2 `apps/web` scaffold: Vite + React, shared tsconfig/Biome/Vitest, Turbo wiring.
      Do **not** extract `packages/ui` yet — a shared UI package needs two real consumers
      to pay for itself; revisit once web ships and desktop is still maintained.
- [ ] 12.3 Browser `SqlExecutor` over OPFS (wa-sqlite/sqlocal in a worker), running the same
      core migrations on boot. Call `navigator.storage.persist()`; browser storage is
      evictable, which is a real durability regression from a SQLite file on disk.
- [ ] 12.4 Port the platform-agnostic views and replace the six Tauri seams: external links
      → `window.open` (the browser fallback already exists), file dialogs → File System
      Access API with a download fallback, window chrome → deleted (the browser is the
      window), capture listener → message ingress, `db/init` → the browser executor.
- [ ] 12.5 Extension capture for web: a content script on the LeetBook origin relays payloads
      to an open tab, queueing in extension storage when no tab is open and flushing on the
      next visit. Both ingress paths share one ingest function. Note this is *worse* than the
      desktop bridge — a background app beats a tab the user has to remember to open.
- [ ] 12.6 Import/export parity plus a first-run "bring my data" flow built on 12.1.
- [ ] 12.7 Static deploy (no server), offline/PWA shell, and an honest storage-eviction
      warning with a backup prompt.
- [ ] 12.8 Web acceptance against `docs/UI_SPEC.md`, excluding the desktop-only window shell.

## Phase 13 — Sync (only if multi-device is actually wanted)

> Deliberately deferred. The append-only review log and the explicit latest-score
> correction path were designed to make this possible later; adding accounts and a server
> reverses `docs/DESIGN.md` §2 and introduces hosting cost, so it needs a real reason.

- [ ] 13.1 Decide the model (own server vs. user-supplied storage) and rewrite DESIGN.md §2
      before writing any code.
