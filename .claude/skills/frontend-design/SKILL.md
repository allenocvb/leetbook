---
name: frontend-design
description: LeetBook's design system and UI conventions. Use whenever building, styling, or reviewing any UI in apps/desktop or the extension's in-page toast — components, layouts, colors, typography, spacing, states.
---

# LeetBook Frontend Design

Read `docs/UI_SPEC.md` completely before building or reviewing UI. It is the final,
repository-owned implementation contract. The PRD controls scope/order, the UI spec controls
visual and interaction details, and the architecture document controls data invariants.

The aesthetic is **Notion meets a paper notebook**: calm and content-first, with Chewy display
type, Quicksand UI/body type, JetBrains Mono for data and code, and one restrained purple accent.

## Non-negotiable design rules

- Implement every color through the semantic light/dark CSS variables in `docs/UI_SPEC.md`.
- Self-host Chewy, Quicksand, and JetBrains Mono WOFF2 assets for offline use.
- Persist the theme and support both final light and dark token sets.
- Match the 1280×820 reference layout before adding flexible-window behavior.
- Use exact documented measurements for the shell, 236px sidebar, table grid, 720px notes
  column, 620px review content, controls, badges, and capture toast.
- Scores, status, due-ness, and counts remain derived from reviews/scheduling.
- Use Tauri's platform URL opener for external links.
- Every interactive element must be keyboard reachable with a visible focus state.
- Keep animations at or below 120ms and limited to background/border colors.
- No gradients, glassmorphism, decorative icon sets, or unapproved replacement tokens.

## React conventions

- One component per file; no component over ~150 lines — split it.
- Presentational components take data via props; data fetching/state lives in hooks
  (`useProblems`, `useReviewSession`) — this keeps components testable with plain Vitest +
  Testing Library.
- Co-locate: `ProblemTable.tsx`, `ProblemTable.test.tsx`, sub-components in a folder.
- Style with plain CSS or CSS modules using semantic CSS variables. Do not continue the current
  one-off inline-style approach for production components.
- Every interactive element keyboard-reachable; review session fully keyboard-driven
  (0–5 to rate, Enter next, Esc exit).
- Add focused behavior tests and visually inspect affected screens in both themes.

## Completion rule

A UI task is not complete because it resembles the current app or because component tests pass.
It is complete only when it satisfies its PRD item, passes the repository gate, and has been
visually compared with `docs/UI_SPEC.md` at the reference size in light and dark themes.
