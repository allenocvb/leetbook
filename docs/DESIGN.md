# LeetBook — Design & Architecture Doc

**Status:** Pre-design phase. Decisions locked, ready for UI design, then development.
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

**v1 explicitly excludes:** cloud sync, accounts, social features, mobile, NeetCode-specific capture (most NeetCode practice links to LeetCode anyway → v1.5).

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
└── apps/extension       # Manifest V3, built with WXT. Content script on leetcode.com.
```

- **Why Tauri over Electron:** ~10MB binaries vs ~150MB, lower memory, enforced UI/system separation.
- **`packages/core` is portable** — a future web version reuses it wholesale.
- **All scraping logic lives in one isolated adapter module** in the extension, with tests. It's the only part that breaks when LeetCode changes; keep the blast radius small.

### 4.1 Extension → App Bridge

- Desktop app runs a tiny HTTP listener on `127.0.0.1` (fixed port + one-time pairing token shown in-app).
- Extension POSTs captured submissions to it.
- App not running → extension queues payloads in `chrome.storage`, flushes on next connect.

### 4.2 Capture Flow

1. Content script detects an **Accepted** submission on leetcode.com.
2. Pulls: slug, title, difficulty, topics (LeetCode public GraphQL), runtime/memory + submitted code (from page).
3. In-page toast: "Rate your recall 0–5."
4. Payload sent to app → upsert problem → log review (with code snapshot + perf stats) → FSRS computes next due date.

### 4.3 Notes Editor

TipTap (ProseMirror) + lowlight code blocks. Notion feel without building an editor. Content stored as JSON; exported as Markdown.

### 4.4 Data Model (sketch)

```
problems    (id, slug, title, url, difficulty, tags[], created_at)
reviews     (id, problem_id, score 0–5, reviewed_at, runtime, memory, code_snapshot)   -- append-only
scheduling  (problem_id, fsrs_stability, fsrs_difficulty, due_at, review_count)
notes       (problem_id, content_json, updated_at)
```

Status and table columns are always **derived**, never stored redundantly. Append-only `reviews` gives history Notion never had, and makes future sync tractable.

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
6. **Review queue + in-app scoring** — ✅ complete, shippable manual product.
7. **Extension** — capture adapter, localhost bridge, pairing, offline queue.
8. **Import/export** — Notion CSV import (existing 47 problems = test fixture), JSON/Markdown export.
9. **Packaging polish** — auto-update, signing, store submission.
10. **Launch** — docs, demo GIF, open-source release.

## 7. Risks

| Risk | Mitigation |
|---|---|
| LeetCode DOM/API changes break capture | Isolated adapter module + tests; app fully usable manually |
| MV3 service worker limits | Capture logic in content script; localhost fetch needs host permission |
| Chrome Web Store review delays | Ship desktop app first (usable standalone); extension follows |
| Editor scope creep | TipTap defaults + code blocks only in v1; no databases/embeds |
| Sync requests from users | Append-only reviews log designed for it; explicitly post-v1 |

## 8. Design Phase Inputs

For the upcoming Claude design session:

- Theme: white-dominant, black text, Notion/notebook aesthetic. Minimal chrome.
- Screens to design: table view (All / Due Today), problem notes page, review queue, extension toast, pairing/settings screen, empty states, Notion import flow.
- Reference: existing Notion setup screenshots (table + note page).
