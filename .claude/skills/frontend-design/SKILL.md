---
name: frontend-design
description: LeetBook's design system and UI conventions. Use whenever building, styling, or reviewing any UI in apps/desktop or the extension's in-page toast — components, layouts, colors, typography, spacing, states.
---

# LeetBook Frontend Design

The aesthetic: **Notion meets a paper notebook.** White-dominant, black text, calm,
minimal chrome. The UI should disappear behind the content. Reference mockups live in
the design deck (see `docs/DESIGN.md` §8 for the screen list).

## Palette

| Role | Value |
|---|---|
| Background | `#FFFFFF` |
| Sidebar / subtle surface | `#FAFAFA` |
| Text primary | `#111111` |
| Text secondary | `#666666` |
| Borders / dividers | `#EBEBEA` |
| Accent (sparingly: active nav, due badges, primary button) | `#5B5BD6` |
| Difficulty Easy / Medium / Hard | `#1A8917` / `#B54708` / `#C92A2A` |
| Status Leech (danger tint) | `#C92A2A` on `#FDECEC` |

Rules: white background, never cream. One accent, used rarely — most of the UI is
grayscale. Dark mode is post-v1; don't build for it, don't block it (use CSS variables).

## Typography

- UI + notes: system-ui stack. Code: `ui-monospace, SFMono-Regular, Menlo, monospace`.
- Sizes: page title 20–24px semibold · section header 14px semibold · body 14px ·
  table cells 13px · captions/labels 11–12px, secondary color, sometimes uppercase+tracking.
- Weight over color for emphasis. No text lighter than `#666` on white.

## Layout & spacing

- Sidebar (~240px, `#FAFAFA`, 1px border) + main pane. Content max-width ~880px for
  notes pages, full-width for tables.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32. Generous whitespace — when in doubt, add space,
  not lines. Dividers only where whitespace can't do the job.
- Rows (table, lists): 40–44px tall, hover background `#FAFAFA`, no zebra striping.

## Components

- **Buttons:** primary = black bg/white text; secondary = white bg, 1px border; ghost for
  everything else. 6px radius. No shadows except floating elements (toast, dialogs).
- **Badges/pills:** difficulty and status as small pills (11px, tinted bg, no borders).
- **Score chips (0–5):** square-ish chips in a row, selected = accent fill. Rubric text for
  the hovered/selected score always visible beneath.
- **Empty states:** one quiet sentence + one action. No illustrations.
- **Capture toast (extension):** white card, 1px border, soft shadow, top-right; title,
  meta line (difficulty · runtime · memory), 0–5 chip row, skip link.

## React conventions

- One component per file; no component over ~150 lines — split it.
- Presentational components take data via props; data fetching/state lives in hooks
  (`useProblems`, `useReviewSession`) — this keeps components testable with plain Vitest +
  Testing Library.
- Co-locate: `ProblemTable.tsx`, `ProblemTable.test.tsx`, sub-components in a folder.
- Style with plain CSS (CSS variables for the palette above) or CSS modules — no runtime
  CSS-in-JS, no Tailwind (keep deps minimal).
- Every interactive element keyboard-reachable; review session fully keyboard-driven
  (0–5 to rate, Enter next, Esc exit).

## Don'ts

Don't add: gradients, glassmorphism, decorative icons everywhere, more than one accent
color, dense borders around everything, animations longer than 150ms, dark backgrounds
on content screens. Don't center body text. Don't ship a component without its test.
