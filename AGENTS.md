# LeetBook — Agent & Contributor Guide

LeetBook is a local-first desktop app (Tauri 2 + React) with a browser extension (WXT/MV3)
for tracking LeetCode practice with FSRS spaced repetition and Notion-style notes.
Monorepo: `packages/core` (pure TS business logic), `apps/desktop`, `apps/extension`.

Read `docs/PRD.md` before writing code. Read `docs/DESIGN.md` for product/architecture context.
Before any UI work, read `docs/UI_SPEC.md` and `.claude/skills/frontend-design/SKILL.md`.

`docs/QA.md` is the manual checklist for everything the automated gate cannot reach
(OS window, platform opener, native dialogs, live LeetCode capture).

Document precedence:

1. `docs/PRD.md` controls scope and implementation order.
2. `docs/UI_SPEC.md` controls visual design and interaction behavior.
3. `docs/DESIGN.md` controls architecture and data invariants.

If an older deck, screenshot, comment, or component conflicts with these files, follow this order.

## Workflow — the most important rules

1. **Work from the PRD, one task at a time.** Pick the single next unchecked task in
   `docs/PRD.md`, implement it fully, then stop. Never tackle multiple tasks at once.
   Never start a task while a previous one is half-done.
2. **Tests gate progress.** Every feature ships with unit tests in the same PR/commit —
   core logic, services, and UI components alike. If any test is failing, fix it before
   starting anything new. Never comment out, skip, or delete a test to make it pass.
3. **Commit often and small.** One logical change per commit. Conventional commits
   (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`). A PRD task may span several
   commits; a commit must never span several PRD tasks.
4. **Before every commit:** `pnpm lint && pnpm typecheck && pnpm test`. All three green
   or no commit. CI runs the same on push — keep `main` green.
   **Also inspect what's staged.** Run `git status` and question anything unexpected —
   especially large counts of files. Never commit build artifacts (`target/`, `dist/`,
   `gen/`, `.output/`, `node_modules/`); if they show up, fix `.gitignore` first.
   Remember: a gitignore pattern with a mid-path slash (like `src-tauri/target/`) anchors
   to the repo root — nested paths need `**/` (this bit us once; see commit f6f04f7).
5. **Mark PRD progress.** When a task is done (implemented + tested + committed), check
   its box in `docs/PRD.md` in that same commit.

## Testing

- Runner: Vitest. Run with verbose logging so failures are visible and countable:
  `pnpm test` runs `vitest run --reporter=verbose` — read the summary (how many failed,
  which, and why) before acting.
- Unit tests live next to the code: `foo.ts` → `foo.test.ts`.
- UI components get tests too (Vitest + Testing Library once `apps/desktop` has real UI).
  Test behavior (what the user sees/does), not implementation details.
- Business logic must be testable without Tauri or a browser — that's why it lives in
  `packages/core`. If logic is hard to test, it's in the wrong place.

## Code style & architecture

- **Simple, modular code.** Small files, small functions, one responsibility each.
  Prefer boring, readable solutions over clever ones.
- **All business logic in `packages/core`** — schema, FSRS scheduling, data access,
  import/export. Apps are thin shells over core. Core never imports from apps.
- **React: small, focused components.** One component per file. Container/presentational
  split where it helps. No component over ~150 lines — split it.
- **Derived data is never stored.** Status, due-ness, table columns are computed from
  `problems`/`reviews`/`scheduling` at read time.
- **All LeetCode scraping stays in one adapter module** in `apps/extension` — the only
  place that breaks when LeetCode changes, and it has tests.
- TypeScript strict; no `any` unless justified with a comment. Biome for lint/format —
  don't hand-format against it.

## Commands

```bash
pnpm install          # install all workspaces
pnpm lint             # biome check
pnpm typecheck        # tsc across workspaces (turbo)
pnpm test             # vitest, verbose reporter (turbo)
pnpm build            # build core, desktop frontend, extension
pnpm --filter desktop tauri dev   # run the desktop app (needs Rust)
```

pnpm 11 / Node 22. Rust is only needed for the desktop shell; core and extension work without it.

## Scope discipline

- v1 excludes: cloud sync, accounts, social features, mobile, NeetCode-specific capture.
  Do not add these, or dependencies for them.
- The desktop app must stay fully usable with manual entry — the extension is an
  automation layer, never a dependency.
- Match `docs/UI_SPEC.md` at the 1280×820 reference size before calling UI work complete.
