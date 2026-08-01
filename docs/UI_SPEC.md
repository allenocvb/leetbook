# LeetBook v1 UI Specification

**Status:** Final implementation contract
**Source:** July 26, 2026 high-fidelity design handoff and `LeetBookpp.key`

This document is the repository-owned source of truth for LeetBook's v1 visual design and
interaction behavior. It replaces the earlier system-font mockup guidance.

## Contract and precedence

- `docs/PRD.md` controls product scope and implementation order.
- This file controls UI appearance, measurements, states, and interaction behavior.
- `docs/DESIGN.md` controls architecture and data invariants.
- If an older screenshot, deck, comment, or component conflicts with this file, this file wins.
- The handoff React files are structural references, not production code. Rebuild them in
  `apps/desktop`, preserve the real data wiring, and keep business logic in `packages/core`.
- Match the specification at the 1280×820 reference size before adding flexible-window behavior.

## Product character

LeetBook should feel like Notion crossed with a paper notebook: quiet, content-first, and warm
without becoming decorative. It uses one restrained purple accent, playful display type for
identity and headings, and precise mono typography for dates, scores, ports, and code.

## Tokens

Implement these as semantic CSS custom properties. Components must not introduce replacement
hex values for an existing semantic role.

### Light

| Token | Value | Use |
|---|---|---|
| `bg` | `#efedf3` | Reserved. Defined for palette completeness only — the app fills the OS window, so nothing paints a backdrop behind it. Do not reintroduce it as a desk. |
| `surf` | `#ffffff` | Main app surface |
| `surf2` | `#fbfafc` | Titlebar, sidebar, row hover |
| `surf3` | `#f7f6fa` | Muted panels and middle score chips |
| `code` | `#fdfdfe` | Code block body |
| `chip` | `#f4f2f8` | Tags and token fields |
| `tint` | `#f1eefb` | Active navigation, chips, progress track |
| `bd` | `#efeef2` | Hairlines |
| `bd2` | `#e8e6ee` | Control borders |
| `ink` | `#191720` | Primary text and solid buttons |
| `txt2` | `#33313c` | Body copy |
| `txt3` | `#57545f` | Secondary copy |
| `mut` | `#8b8896` | Metadata |
| `mut2` | `#a5a2b0` | Labels |
| `mut3` | `#b3b0bd` | Quiet controls |
| `mut4` | `#c2bfcc` | Faint affordances |
| `acc` | `#6d4aff` | Purple accent |
| `accTxt` | `#5638d8` | Accent text on tint |
| `green` | `#3d7a52` | Easy and mastered |
| `amber` | `#9a6b1f` | Medium |
| `red` | `#a63b4c` | Hard, leech, low score |
| `softRed` | `#fdeef0` | Low-score background |
| `kw` | `#8b5cf6` | Code keyword |

Status pills:

- Mastered: `#eef7f0` background, `#3d7a52` foreground.
- Learning: `#f1eefb` background, `#5638d8` foreground.
- Leech: `#fdeef0` background, `#a63b4c` foreground.
- New: `#f4f2f8` background, `#57545f` foreground.

### Dark

Use the same semantic keys: `bg #0e0d11`, `surf #18171d`, `surf2 #1c1b22`,
`surf3 #212028`, `code #141319`, `chip #272631`, `tint #2a2340`, `bd #252430`,
`bd2 #2f2e3b`, `ink #f2f1f6`, `txt2 #dcdae3`, `txt3 #a8a5b3`, `mut #8b8896`,
`mut2 #7d7a89`, `mut3 #6a6776`, `mut4 #565364`, `acc #8b6bff`,
`accTxt #bda6ff`, `green #6cba86`, `amber #cfa04c`, `red #e0808f`,
`softRed #301c22`, and `kw #a98bff`.

Dark status pills:

- Mastered: `#1c2a21` background, `#6cba86` foreground.
- Learning: `#241f3a` background, `#bda6ff` foreground.
- Leech: `#301c22` background, `#e0808f` foreground.
- New: `#272631` background, `#a8a5b3` foreground.

### Typography and geometry

- Display: Chewy, one weight only. Logo, screen titles, note headings and score numerals.
  Never below 16px — it is unreadable at interface sizes.
- Body/UI: Rubik 400/500/600/700. Subtly rounded terminals echo Chewy without the bounce,
  legible down to 10.5px, which Chewy is not. `font-synthesis-weight: none` is set globally so
  Chewy is never faux-bolded; Rubik carries real weights instead.
- Mono: JetBrains Mono 400/500.
- Self-host WOFF2 files so the Tauri app remains fully local and works offline.
- Type scale: 10.5, 11, 11.5, 12, 12.5, 13.5, 14.5, 16, 19, 20, 22, 24, 29, 34,
  38, and 46px.
- Radius scale: 5, 6, 7, 8, 9, 11, 12, 14, and 20px for pills.
- Spacing scale: 4, 6, 9, 12, 16, 22, 26, and 34px.
- Window shadow: `0 24px 60px rgba(25,23,32,.18), 0 2px 6px rgba(25,23,32,.08)`. Reserved for
  large floating panels only. The app shell must not use it — the OS draws the window's shadow.
- Floating shadow: `0 18px 40px rgba(25,23,32,.16)`.
- Transitions are optional and limited to 120ms on background and border colors.

## Shared behavior

- Persist light/dark theme and apply it to the document background and app surface.
- Every interactive control must be keyboard reachable and have a visible focus state.
- External URLs in Tauri must use the platform URL opener, with a browser-safe fallback for tests.
- Status, due-ness, latest score, review count, and dates remain derived from core records.
- A score is recorded by appending or explicitly correcting a review; never write a redundant
  score field to a problem.
- The desktop app remains fully usable without the extension.

## Screens

### Window shell and intro

- Reference viewport: 1280×820. **The OS window is the app window.** The shell fills it
  edge to edge — never a desk background or outer padding, which would draw a second window
  inside the real one.
- The window is **decorated** and uses macOS's own controls via `titleBarStyle: "Overlay"`.
  The OS therefore supplies the corners, the shadow and the traffic lights, and the green
  button's Move/Resize/Tile menu works because those buttons are real. Do not draw window
  controls in the app: a drawn circle cannot offer that menu, and imitating it was what
  forced the earlier transparent-window workaround. Nothing in CSS sets a window radius or
  shadow.
- Titlebar: 38px high, `surf2`, 1px `bd` bottom border, with a **78px left inset** so app
  content clears the overlaid system buttons. It carries the app name and a right-aligned
  theme toggle only.
- The titlebar is a drag region. `data-tauri-drag-region` calls `startDragging()`, which
  `core:window:default` does not cover, so `core:window:allow-start-dragging` must be
  granted. Without it dragging fails silently while resizing still works, because resizing
  is handled by the window manager rather than the permission system.
- Intro: centered 54px logo, Chewy 46px title, 13.5px tagline, `Le(e)t's Code` primary button,
  and an 11px mono problem/due count.
- The intro opens on **every launch**, not just the first. Nothing is persisted about
  having seen it; the button opens All Problems and it does not reappear until relaunch.

### Sidebar

- Fixed 236px width, `surf2`, 1px `bd` right border, `16px 10px 12px` padding.
- Header: 22px logo, Chewy 16px name, mono 10px `v1`.
- Navigation order: All Problems, Due Today, Review Session, Settings & Pairing. There is no
  Capture view: the approval handshake made its setup guide a few lines, and every piece of
  live state it showed (listener, queue, last capture, pairing) already lives in Settings.
- Navigation rows use 7px radius and `7px 9px` padding. Active and hover states use `tint`;
  the active label uses `accTxt`.
- Show category counts beneath a 10.5px uppercase section label. Clicking a category filters
  the table; clicking it again clears the filter.
- Footer shows real extension/listener state and port. Do not claim “connected” without evidence.

### Problem table

- Header padding: `26px 34px 0`; Chewy 29px title and 12.5px subtitle.
- Header actions: 190px search, Filter outline button, and solid `+ New problem`.
- All Problems and Due Today are tabs with a shared hairline and 2px active underline.
- Grid columns: `1.7fr .9fr .8fr .8fr .5fr .5fr 1fr .7fr 28px`; 16px gap. The trailing
  28px track is the row action column and is reserved on the header too, so it stays aligned.
- Columns: Name, Status, Next Review, Last Review, Score, Reps, Category, Difficulty.
- The rows sit in a `surf` card — 1px `bd2` border, `radius-7`, `0 10px 6px` padding — on a
  `surf2` scroll area inset `16px 34px 24px`. One surface step is what makes the card edge
  read without a shadow.
- Header and rows share a 12px horizontal inset so columns line up with the row hover fill.
- Sticky header uses 11px uppercase `muted` labels, `14px/11px` padding, `bd2` underline.
  Rows use 16px vertical padding in comfortable density and 9px in compact.
- Row separators are an inset pseudo-element on the row's **top** edge, hidden on the first
  row. Top rather than bottom so `:hover` can suppress both adjacent rules with forward
  combinators only — CSS has no previous-sibling selector, and a real `border-bottom` would
  cut across the rounded hover fill.
- Row hover is `surf3` filled to `radius-4`, inset from the card edge — a full-bleed stripe is
  what made the table read as a spreadsheet.
- Row title: 14px/500 `ink`. It is the row's subject; every other cell is metadata.
- Category renders as chips (`chip` background, pill radius, 11.5px), capped at two with the
  remainder collapsing to `+N`. The column is one line tall, and the full list stays in the
  cell's `title`. No categories shows an em dash.
- Difficulty is a 6px dot plus a 12.5px label, not a pill. Status is already a pill and two
  pills side by side compete for the same attention.
- `Next Review` reads `Today` in `accent` at weight 500 when due — the one value worth
  spotting while scanning.
- Clicking anywhere in a row opens the notes page, but the row is **not** a button: the name
  is the only real control and stretches its hit area across the row with `::after`. A button
  cannot legally contain another button, and the row needs to carry actions. The arrow glyph
  stays decorative, not a second competing link.
- Each row carries a delete action in the trailing column: a muted `×` that appears on row
  hover and is always present for keyboard focus. It sits above the stretched hit area so it
  never navigates. Deleting confirms in a dialog rather than inline — a 28px column cannot
  hold a Cancel/Delete pair — and removes the problem with all its reviews, notes and
  scheduling.
- Score chip: 23×23px, `radius-2`. Scores 0–1 use `softRed/red`, 2–3 use `surf3/txt3`, 4–5 use
  `tint/accTxt`, and missing uses `surf3/mut4`.
- Status pill: `4px 10px` padding, 11.5px at weight 500.
- Provide sort, search, category filtering, filter clearing, empty state, and `+ New`.
- The row area scrolls under a sticky header. The page must take its height explicitly
  (`height: 100%`); the flush main pane is a block container, so relying on `flex: 1` collapses
  the page to content height and the table is clipped instead of scrolled.

### System design table

- Reached from a fifth sidebar item, `System Design`, placed after `Review Session`.
- Reuses the problem table's card, rows, hover, chips and pills outright. Only the grid
  template differs: `2.1fr .9fr .8fr .8fr .5fr .5fr 1.1fr 28px`, min-width 760px. Two tables
  that look subtly different for no reason is worse than one shared stylesheet.
- Columns: Topic, Status, Next Review, Last Review, Score, Reps, Tags. **No difficulty** — a
  design topic has none, and an empty column would imply otherwise.
- Header carries a search field and a solid `+ New topic`. No tabs, no category rail, no
  density toggle: there is only one design view, and tags are not a canonical taxonomy.
- Search matches title, prompt and tags. The prompt is where the distinguishing words live.
- Status uses the same `deriveStatus` as problems, so `Mastered` means the same thing in both.
- Never-reviewed topics show an em dash for both dates rather than a blank cell.
- Tags are free text, comma-separated in the dialog, rather than the closed dropdown problems
  use. There is no agreed system design taxonomy to pick from, and inventing one would bake a
  guess into the UI; duplicates differing only by case or spacing are still folded on write.

### System design topic notes

- Same 720px shell, editor, autosave and save-status treatment as problem notes. The editor is
  reused outright — headings, code blocks, callouts and the selection bar earn their place in a
  design write-up too, and a second editor would drift from the first.
- Back link reads `← System Design`.
- No difficulty, no external link, no runtime or memory: a design topic has none of them.
- The prompt sits between the title and the metadata list, indented behind a 2px `bd-2` rule
  and preserving newlines. It is the question being asked, not a field of the topic, and the
  block is omitted entirely when empty rather than rendering a dash.
- Metadata: Tags, Next review, Last review. Unreviewed reads `Not reviewed yet`.
- Actions are `Edit topic` and `Delete topic`. Delete confirms inline, replacing the trigger
  with Cancel/Delete, matching the problem notes page rather than the table's dialog.
- The editor's accessible name is `Topic notes`, not `Problem notes`.
- Reviewing is **not** available here; that is the Phase 15 review session.

### Problem notes

- Centered 720px column with `26px 40px 80px` padding.
- Back link is 12.5px `mut`; title is Chewy 38px; external link is an outline button.
- Metadata grid is `118px 1fr`, 9px row gap, 12px column gap. Include difficulty, category
  chips, next review, last review with latest score and reps, and latest runtime when present.
- Allow editing title, URL, difficulty, and categories without making derived scheduling fields
  directly editable.
- Categories are a **closed set**, picked from a dropdown of LeetCode's topic list and shown as
  removable chips — never free text. Typed categories produced near-duplicates that fragmented
  the sidebar (a Notion export said "HashTable" while capture supplied "Hash Table"). Every
  write path normalizes through the canonical list, and existing rows are folded together on
  boot.
- Review history rows reserve the correct-score column at a fixed width. Each row is its own
  grid and only the latest row carries that button, so an `auto` track collapses to zero
  elsewhere and knocks the score labels out of alignment.
- Provide a `Log review` action so any problem—not only an already-due problem—can receive a
  0–5 review.
- `Edit latest review` changes the latest score, its date, and the rep count in one dialog,
  then replays FSRS over the full history. Changing the date may reorder history, so the
  replay sorts chronologically first. Rep count is an explicit override of stored FSRS state,
  not a count of rows — the Notion import already sets it independently — so correcting an
  imported total does not fabricate review records. A replay must **preserve** the stored rep
  count unless explicitly overridden: it derives reps from the number of review rows, which is
  wrong whenever the two legitimately differ, and silently reset imported problems to 1.
  The dialog states that reps drives status (Mastered needs three), not the schedule — the
  next review date comes from FSRS stability, so editing reps deliberately leaves it alone.
- Deleting a problem lives here, not in the table: a table row is a single button that opens
  notes, so a second control inside it would compete with that contract. The action is a ghost
  `Delete` that swaps in place for a `Delete for good?` label plus Cancel/Delete, matching the
  pairing-token regenerate control. Deleting removes the problem and every derived record, then
  returns to the table.

Editor:

- TipTap document body is 14.5px with 1.72 line height.
- H2 is Chewy 22px with `26px 0 6px` margin.
- Support headings, paragraphs, bold, italic, inline code, bullets, numbered lists, blockquote,
  callout, and syntax-highlighted code blocks.
- Empty editor placeholder: `Type “/” for commands…`.
- Selecting text raises a floating format bar: bold, italic, underline, strikethrough, text
  colour, highlight, inline code, link, and clear formatting. Every mark but colour already
  shipped with the editor; the bar exists because keyboard shortcuts alone left them
  undiscoverable. Buttons suppress mousedown so the selection survives the click, and the bar
  never appears inside a code block, where marking up source is meaningless.
- Text colour and highlight each open a five-swatch grid — purple, blue, green, amber, red —
  ending in a dashed reset swatch. Picking closes the grid; moving the selection closes it too,
  since the bar repositions and would otherwise leave a stale grid over the document. Colours
  are written into the note as `var(--lb-note-*)` / `var(--lb-mark-*)` references rather than
  resolved hex, so a passage coloured in light mode stays legible in dark mode instead of
  freezing at whichever palette was active when it was written.
- Slash menu exposes the supported block types and is fully keyboard operable. Exactly one item
  is ever highlighted: hovering adopts the active index rather than styling a second row, so the
  item under the pointer is always the one Enter will insert. Keeping the active item in view
  must scroll the menu only — `scrollIntoView` walks every scrollable ancestor and drags the
  notes page with it.
- The document surface takes no focus ring. `:focus-visible` matches while typing, so a ring
  there boxes the whole note on every keystroke; the caret is the focus indicator, as in any
  text field. Discrete controls inside the editor keep their own focus styles.
- Code blocks show a `surf2` header with language on the left and optional snapshot date on the
  right, followed by a `code` body using JetBrains Mono 12.5px.
- Inserting a code block leaves the caret **inside** it, ready to type.
- The editable code block uses a plain DOM node view whose `contentDOM` is the `<code>` element.
  It must not be a React node view: React's renderer nests its own managed element inside the
  content element, and an empty code block built that way cannot receive a DOM selection — the
  caret lands in the paragraph after the block and typing goes underneath it. Block types with
  no node view are unaffected, which is how the fault was isolated.
- An editable code block behaves like a code editor: Tab inserts two spaces rather than moving
  focus to the language picker, Shift-Tab removes one level, and Enter carries the current
  indentation onto the next line, stepping in once after a line ending in `:`, `{`, `(`, or `[`.
- With a selection, Tab and Shift-Tab shift **every line the selection touches** and reselect
  them, so the keys can be pressed repeatedly. They must never replace the selection — doing so
  deletes the highlighted code. Blank lines are skipped rather than filled with whitespace.
  Tab is therefore captured while the caret is in code; the language picker stays reachable by
  pointer and from adjacent focus stops.
- `/` inside a code block is division or a comment, never a command — the slash menu stays shut.
- Captured code snapshots are read-only and visually consistent with editable code blocks.
- Autosave reports Saving/Saved without moving content.

### Review session

- Top bar includes label, 4px progress track, mono `N of M`, and Exit.
- Center content is 620px wide. Use Chewy 34px title and show difficulty, last score, and reps.
- Provide working `Open on LeetCode` and `Show my notes` actions.
- Six equal score tiles show 0–5, labels, hover/selected state, full rubric, and FSRS preview.
- Keyboard behavior: 0–5 selects, Enter confirms, Escape exits.
- Confirming appends a review, recomputes FSRS, and advances. End with a session summary.

### Extension capture toast

- Fixed bottom-right with 22px inset, 320px width, 11px radius, `surf`, `bd2`, and the
  floating shadow.
- Header shows the logo, “Accepted · captured” or “Queued — N waiting,” and dismiss.
- Show title, difficulty/runtime/memory/code status, and six score buttons.
- A chosen score is posted or queued. Dismiss/skip schedules as Good, as specified by the handoff.
- Shadow DOM isolates the toast from LeetCode styles.

### Settings and pairing

- Content has `28px 34px` padding and a 600px maximum width.
- Three cards use `bd2`, 9px radius, 18px padding, and 14px gaps.
- Connection card: truthful connection state, last capture, listener, paired-extension state,
  Disconnect, and queued count. It also carries the three-step setup guide, shown **only while
  nothing is paired** — instructions that disappear once they stop being useful. The pairing token is **never displayed**. Showing it invites
  the copy-paste flow the approval handshake replaced.
- Scheduling card: FSRS identity, daily new limit, and score mapping.
- Data card: database stats, Import Notion CSV, Export JSON, and Export Markdown.
- Import result explains imported/skipped rows and offers an immediate route to imported problems.

## Required validation

Each remediation task ships with focused tests. Before checking a PRD item:

1. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
2. Render every affected screen at 1280×820 in light and dark themes.
3. Compare against the UI contract for layout, typography, color, states, and interaction.
4. Test Tauri-only behavior, including external links and file operations, in the desktop shell.
5. Verify the extension toast on an actual or fixture LeetCode page.
