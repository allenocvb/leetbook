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

From Phase 13 the same scheduling engine also covers **system design** — a notebook with a
diagram canvas and its own review format. Interview prep is both halves, and only one of them
has an Accepted verdict to capture.

**The rubric (0–5 recall score, UX-facing; maps internally to FSRS Again/Hard/Good/Easy):**
0 blackout · 1 familiar-after-seeing · 2 knew-approach-after-hint · 3 correct-with-struggle ·
4 correct-with-hesitation · 5 perfect recall

## Non-goals (v1)

No cloud sync, no accounts, no social features, no mobile, no editor embeds/databases.
Local-first is a feature.

NeetCode capture was on this list and has been promoted to Phase 12. The reasoning that
retired it — that NeetCode practice mostly links out to LeetCode — describes the site, not the
user: solving in NeetCode's own editor never touches leetcode.com, so capture saw nothing at
all.

**"No servers" survives Phase 16; "no network" does not.** The AI quiz calls a provider with
the user's own key — there is still no LeetBook backend and no account — but notes do leave the
machine when questions are generated. Off by default, cached so reviews stay offline, and the
docs must say so plainly rather than keeping a promise that has quietly stopped being true.

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
- [x] 9.24 Launch intro: show the intro on every launch instead of only the first, and stop
      persisting a seen-it flag
- [x] 9.25 Native macOS window controls: switch to a decorated window with
      `titleBarStyle: "Overlay"` so the green button offers Move/Resize/Tile, remove the drawn
      traffic lights, and drop the transparent-window workaround they made necessary
- [x] 9.26 Type pairing: Chewy for display only (titles, headings, brand, score numerals),
      Rubik for all interface text, with synthetic bold disabled
- [x] 9.27 Canonical categories: closed LeetCode topic list picked from a dropdown, normalized
      on every write path, with existing variant spellings folded together on boot
- [x] 9.28 Editable scheduling: change the latest review's score, date and rep count from one
      dialog, replaying FSRS over re-sorted history
- [x] 9.29 Delete from the table: restructure the row so it can carry actions, add a
      hover-revealed delete with dialog confirmation, and keep whole-row navigation
- [x] 9.30 Pairing handshake: extension requests pairing, the app approves it with a matching
      code, and the token is exchanged automatically — no copy-paste, and the token is no longer
      shown in the UI at all
- [x] 9.31 Retire the Capture view: fold its setup guide into the Settings connection card and
      delete the page, route and nav item now that pairing is a handshake
- [x] 9.32 Capture the real submission: read code, language and stats from LeetCode's
      submission API instead of localStorage and a fixed DOM climb, both of which silently
      returned nothing on the live page
- [x] 9.33 Indent a selection in a code block: Tab and Shift-Tab shift whole lines instead of
      replacing the selection, which deleted the highlighted code
- [x] 9.34 Selection format bar: floating bold/italic/underline/strike/code/link/clear over a
      text selection, suppressed inside code blocks
- [x] 9.35 Text and highlight colour: a five-swatch palette on each, stored as `var(--lb-*)`
      references so a note coloured in one theme stays legible in the other
- [x] 9.36 Documentation: `docs/OVERVIEW.md` explaining the product and the architecture, and
      a README with prerequisites, a clone-to-running walkthrough, extension setup, every
      command, and troubleshooting
- [ ] 9.37 Desktop acceptance: work through `docs/QA.md` in a real `tauri dev` build —
      window shell, external links, file dialogs, editor and review flows — then capture
      reference screenshots and record known limitations. The automated gate cannot reach
      any of it; the window rounding and fullscreen behaviour are unverified so far.

## Phase 10 — Packaging

- [ ] 10.1 tauri-action release builds + auto-update
- [ ] 10.2 macOS signing/notarization; Chrome Web Store submission

## Phase 11 — Launch

- [ ] 11.1 Launch README with demo GIF, extension setup, CONTRIBUTING.md, and issue templates
- [ ] 11.2 v0.1.0 release

## Phase 12 — NeetCode as a second capture source

> Promoted from the v1 non-goals. Someone working the NeetCode 150 in NeetCode's own editor
> never touches leetcode.com, so capture saw nothing — the automation silently did not apply
> to a large share of real practice.
>
> **Do not write selectors from memory.** The LeetCode adapter cost four wrong guesses before
> anyone looked at the live page; the fix came from two console diagnostics. 12.2 exists to
> make sure that happens first this time.

- [x] 12.1 Capture source seam: define the `CaptureSource` contract (match, slug, verdict,
      metadata, submission), move LeetCode behind it, and drive the content script from the
      registry rather than from LeetCode's functions directly
- [x] 12.2 NeetCode reconnaissance: run `docs/recon/neetcode.js` — step 1 before submitting,
      step 2 after the verdict, step 3 for the network and slug questions — and record the
      findings here before writing any code.

      **Confirmed** (neetcode.io, `two-integer-sum`, July 2026):

      - Angular SPA (`app-prompt`, `app-output-tab`, `app-modal`). No `data-*` hooks; class
        names are the only locators available.
      - URL is `/problems/<neetcode-slug>`, with `/history?submissionIndex=N` after a
        submission. The slug is **not** in the last path segment.
      - Verdict: `.submission-result-accepted`, on an `h1.submission-status-title` in the
        history pane and on a `p` inside `.output-header` in the console pane. One class
        serves both.
      - `Passed test cases: 23 / 23` sits in `p.test-case-count`.
      - **Title is `h1.problem-title`, and it matches LeetCode's title exactly** — "Two Sum",
        despite the slug being `two-integer-sum`. Only the URL is renamed.
      - **Runtime and memory are on the page**: "Memory: 7.7 MB · Time: 28ms" in the
        submission header, plus Beats-% cards. No API call needed.
      - **The submitted code is rendered as static text** under a "Code | Python" heading on
        the submissions pane — not inside a virtualised editor, so unlike LeetCode it can be
        read straight from the DOM.

- [x] 12.3 Cross-site problem identity: NeetCode renames the URL slug (`two-integer-sum`) but
      **not the title** (`Two Sum`), and LeetCode's slugs are slugified titles. So the join is
      `slugify(neetcodeTitle)` → LeetCode slug, then **verified** by fetching LeetCode's
      metadata for that slug and comparing the returned title. A mismatch means don't merge.

      Self-checking beats a shipped mapping table: no 150-row file to maintain, no silent
      wrong merge, and the failure mode is a skipped capture rather than a corrupted history.
      Fuzzy title matching is rejected outright — "Subarray Sum Equals K" and "Minimum Size
      Subarray Sum" are different problems and the app has no un-merge path.

      Note: the verification fetch must run in the **background worker**, not the content
      script. A content script on neetcode.io calling leetcode.com is cross-origin and CORS
      will block it; the worker has host permissions and is not subject to it.
- [x] 12.4 NeetCode adapter: implement `CaptureSource` from 12.2's findings, in its own module
      with its own fixture tests, and register it
- [x] 12.5 Manifest and content script: add the NeetCode host to `matches` and to the extension
      permissions, and confirm the single content script serves both sites
- [ ] 12.6 Degrade honestly: a NeetCode problem with no LeetCode counterpart, or one whose
      title verification fails, must not be silently dropped or silently merged. Say which it
      is in the toast, and keep a capture that is missing runtime or memory working anyway
- [ ] 12.7 Cross-source acceptance: solve the same problem on both sites, confirm one problem
      row with two reviews and a correctly replayed schedule, and add the walkthrough to
      `docs/QA.md`

---

# System design

> LeetCode practice is recall of a known answer. System design is not — there is no Accepted
> verdict, no single solution, and the thing worth remembering is a diagram and a set of
> trade-offs. It needs its own notebook, its own review format, and its own entity. What it
> reuses is the part that matters most: FSRS scheduling, unchanged.
>
> **Sequencing rule.** Each phase below must be independently useful. Phase 13 without 14 is
> still a notebook; 14 without 15 is still a diagram tool; 15 without 16 is still a working
> review loop. Nothing here may leave the app in a state that only pays off two phases later.

## Phase 13 — System design topics and notes

- [x] 13.1 Domain and schema: a `DesignTopic` entity (id, title, prompt, tags, created_at) with
      its own migration, repository and tests in `packages/core`. Deliberately **not** a
      `Problem`: there is no slug, URL, difficulty or runtime, and forcing it into that table
      would put six always-null columns on every LeetCode row
- [x] 13.2 Scheduling reuse: point `design_scheduling` at the existing FSRS wrapper untouched.
      A design topic is a memory like any other; the scheduler should not know the difference.
      Prove it with tests that replay a design history through the same `scheduleReview`
- [ ] 13.3 Topics table: a second table view listing design topics with status, next review and
      tags, reusing the restyled problem table's row treatment rather than a second style
- [ ] 13.4 Topic notes page: reuse the TipTap editor wholesale. Prose, headings, code blocks
      and callouts are exactly as useful for a design write-up as for a LeetCode note
- [ ] 13.5 Sidebar and navigation: a System design section that does not disturb the existing
      four items or their counts

## Phase 14 — Diagram canvas

> Excalidraw is MIT and ships as a React component with React 19 in its peer range. Writing a
> drawing engine — freehand smoothing, shape binding, selection, undo — is months of work to
> land somewhere worse. This phase is an integration, not an implementation.

- [ ] 14.1 Embed `@excalidraw/excalidraw` behind our own thin wrapper component, so the rest of
      the app imports a LeetBook interface rather than a vendor one and the dependency can be
      replaced without touching call sites
- [ ] 14.2 Lazy-load it. The package is large and must not sit in the initial bundle; the
      problem table's startup time is not allowed to regress because of a feature it never uses.
      Measure before and after and record both numbers
- [ ] 14.3 Persist the scene: `getSceneElements()` + `getAppState()` serialised to JSON on the
      topic, autosaved on the same debounce as notes, restored on open. Round-trip test with a
      scene containing every element type
- [ ] 14.4 Theme binding: drive Excalidraw's `theme` prop from our own toggle so the canvas does
      not stay light while the app goes dark
- [ ] 14.5 Asset and offline check: Excalidraw pulls fonts and assets, which must resolve inside
      a packaged Tauri build with no network. Verify in a real `tauri build`, not `dev`
- [ ] 14.6 Peer-dependency reality check: its Radix transitive deps warn against React 19.
      Confirm warnings only, no runtime breakage, and record the finding so the next person does
      not re-investigate

## Phase 15 — Design review sessions

> Deliberately before any AI. A review loop with questions you wrote yourself is a complete,
> working feature; if the loop is wrong, no model fixes it.

- [ ] 15.1 Design review session: same shape as the LeetCode session — one topic at a time,
      progress bar, keyboard flow, summary — showing the prompt, then your notes and diagram
- [ ] 15.2 Self-rated 0–5 against the existing rubric, appended to the review log and scheduled
      through the same FSRS path
- [ ] 15.3 Authored questions: write your own questions per topic (multiple choice or free
      text) and store them. This is the data model the AI layer will later populate, so getting
      it right without a model in the loop is the point
- [ ] 15.4 Quiz run-through: answer each question, see the model answer, then rate recall.
      Multiple choice is graded locally with no network at all
- [ ] 15.5 Due Today includes design topics alongside problems, or the schedule is invisible

## Phase 16 — AI quiz

> **This is the first feature that breaks "works with no network", and the first that sends
> user content anywhere.** `docs/DESIGN.md` and the README both promise local-first with no
> servers and no telemetry. That promise has to be rewritten honestly before this ships, not
> quietly bent.
>
> Two decisions taken up front:
>
> 1. **Bring your own key.** The user supplies an API key, stored locally, and the app calls the
>    provider directly. No LeetBook server ever exists, so "no accounts, no backend" stays
>    literally true. Written behind a provider interface so a local Ollama backend is a later
>    addition rather than a rewrite.
> 2. **Generated once, cached forever.** Questions are stored on the topic. Reviews then run
>    fully offline, and the network is touched only when authoring or explicitly regenerating.
>    This keeps the daily loop local even though the feature is not.

- [ ] 16.1 Provider interface: `QuizProvider` with `generateQuestions(notes)` and
      `gradeAnswer(question, answer)`. One implementation (Anthropic), fully tested against
      recorded fixtures so the suite never makes a network call
- [ ] 16.2 Key handling: entered in Settings, stored in the OS keychain rather than SQLite or
      plain config, never logged, never included in exports. Absent key degrades to Phase 15's
      authored questions rather than erroring
- [ ] 16.3 Question generation: produce a mix of multiple choice and free text from a topic's
      notes, reviewed and editable by the user before they are saved. A model writing directly
      into stored content with no human pass is how bad questions become permanent
- [ ] 16.4 Free-text grading: the model returns a score with reasoning. **It proposes; the user
      confirms or overrides, and the user's number is what is stored.** The entire review log
      rests on honest self-rating, and a lenient grader would push a topic weeks out while
      looking like it worked — corrupting the schedule invisibly. This constraint is not
      negotiable for a convenience win
- [ ] 16.5 Failure behaviour: no network, bad key, rate limit and malformed response each say
      what happened and fall back to self-rating. A quiz must never block a review
- [ ] 16.6 Cost and consent: show what a generation will cost before it runs, and state plainly
      in the UI that notes are sent to the provider. Off by default
- [ ] 16.7 Honest documentation: update `DESIGN.md` §3 non-goals, `OVERVIEW.md`, and the
      README's "your data stays yours" claim to describe what actually happens, including
      exactly what is sent and when
- [ ] 16.8 Acceptance: generate, edit, quiz, grade, override and reschedule a real topic
      end to end; then pull the network cable and confirm the whole loop still runs on cached
      questions. Add both walkthroughs to `docs/QA.md`
