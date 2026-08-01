# LeetBook — manual QA checklist

Everything here needs a real `tauri dev` (or a release build). The automated gate covers
core logic, React behaviour and the extension adapter, but it runs in jsdom against a
Node SQLite shim — it cannot prove anything about the OS window, the platform opener,
native file dialogs, or a live LeetCode page.

Run before checking PRD 9.24, and again before any release.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test   # must be green first
pnpm --filter desktop tauri dev
```

## 1. Window shell

The window is decorated with `titleBarStyle: "Overlay"`, so macOS supplies corners, shadow
and controls. The config validates against the Tauri 2 schema, but only a build proves it.

- [ ] Real macOS traffic lights appear, correctly positioned, and the app draws none of its
      own. `LeetBook` in the titlebar clears them — adjust the 78px inset if it looks off.
- [ ] **Hovering green shows the Move/Resize/Tile menu**, and tiling to half the screen works.
      This is the whole reason for the switch away from drawn buttons.
- [ ] Rounded corners and a drop shadow, supplied by the OS.
- [ ] **No desk border.** Content reaches every edge; no second window inside the window.
- [ ] **Dragging the titlebar moves the window** (needs `core:window:allow-start-dragging`;
      this failed silently once before, while resizing still worked).
- [ ] Resize from an edge, down to the 800×600 minimum.
- [ ] Theme toggle switches light/dark and **survives a restart**.
- [ ] Chewy is confined to screen titles, the sidebar brand, section headings, note headings,
      dialog titles and score numerals. Everything else — table rows and column headers,
      notes metadata labels, nav items, buttons, form fields — is Rubik. Nothing is
      faux-bolded.

## 2. Data and persistence

- [ ] The intro shows on **every** launch; `Le(e)t's Code` opens All Problems and it does not
      come back until the next launch.
- [ ] Problems added in one session are still there after quitting and reopening.
- [ ] Import the real Notion CSV from Settings. Counts match; skipped rows explain why;
      "view imported problems" lands on the table.
- [ ] Re-import the same file: reported as unchanged, no duplicate reviews.

## 3. External links and files — Tauri-only paths

- [ ] `Open on LeetCode` from the notes page opens the **default browser**, not a new app
      window.
- [ ] Same from the review session.
- [ ] Export JSON: native save dialog, file written, valid JSON.
- [ ] Export Markdown: native save dialog, notes readable.

## 4. Table

- [ ] The table **scrolls** with more rows than fit, under a sticky header. (Regression:
      it used to clip instead.)
- [ ] Search, sort by each column, category filter from the sidebar, clear filter.
- [ ] The sidebar lists each category once — no `Hash Table` / `HashTable` split. Existing
      rows are folded together on boot.
- [ ] Adding or editing a problem offers categories as a dropdown with removable chips,
      never a free-text field.
- [ ] Clicking anywhere in a row opens notes; the arrow is decorative, not a second target.
- [ ] Comfortable/compact density.
- [ ] Hovering a row reveals a `×` at the far right. Clicking it opens a confirm dialog and
      does **not** navigate to notes. Cancel leaves the row; confirming removes it.
- [ ] Tab through the table: the `×` is reachable by keyboard and visible when focused.

## 5. Notes editor

- [ ] Typing autosaves — status shows Saving then Saved, and content survives navigating
      away and back.
- [ ] **No purple focus box** around the document while typing.
- [ ] `/` opens the slash menu. Arrow keys and mouse hover highlight **the same single
      row**; Enter inserts the row under the cursor.
- [ ] `/code` puts the caret **inside** the code block — type immediately, text lands in
      the block, not underneath it.
- [ ] In a code block: Tab indents (does not jump to the language picker), Shift-Tab
      outdents, Enter after `for i in range(10):` indents the next line.
- [ ] Select several lines in a code block and press Tab: every line shifts right and stays
      selected, so Tab can be pressed again. Shift-Tab brings them back. Nothing is deleted.
- [ ] Typing `l` at the start of a code line is **not** auto-capitalised; quotes stay
      straight, `--` is not turned into an en dash.
- [ ] `/` inside a code block does not open the slash menu.
### Problem table

- [ ] Rows sit in a bordered card with visible breathing room, not flush to the page edge.
- [ ] Hovering a row fills a **rounded** block inset from the card edge, and the hairlines
      above and below that row disappear — no rule cutting through the rounded corners.
- [ ] The first row has no rule above it; the last has none below.
- [ ] Categories show as chips. A problem with 4+ categories shows two chips and `+2`, stays
      one line tall, and reveals the full list on hover.
- [ ] A problem with no categories shows an em dash, not an empty cell.
- [ ] Difficulty is a coloured dot plus label; only Status is a pill.
- [ ] Switch to compact density: rows tighten, and nothing overlaps or clips.
- [ ] Toggle dark mode: the card, its border, the chips and the hover fill all remain
      distinguishable from the page behind them.
- [ ] Scroll a long list: the sticky header stays put and rows pass cleanly beneath it.

### System design table

- [ ] The sidebar has **five** items; `System Design` sits after `Review Session`.
- [ ] Add a topic with a title, prompt and two tags. It appears without a reload.
- [ ] Tags typed as `Caching, caching` produce **one** chip, not two.
- [ ] Adding with an empty title is refused with a visible message.
- [ ] Search matches a word that appears only in a prompt, not in any title.
- [ ] Sorting by each column works and reverses on a second click.
- [ ] There is **no** Difficulty column.
- [ ] Delete a topic: it confirms in a dialog, disappears, and stays gone after a restart.
- [ ] Toggle dark mode: the table matches the problem table exactly.
- [ ] Export JSON from Settings and open it: the `designTopics`, `designReviews`,
      `designScheduling` and `designNotes` keys are present, and populated if you have topics.

### Notes editor

- [ ] Select some prose: a format bar appears. Bold, italic, underline, strikethrough and
      inline code all apply and show as active. Clear formatting removes them.
- [ ] Link prompts for a URL, applies, and an empty value removes it.
- [ ] Text colour opens a swatch grid; picking one recolours the selection and closes the grid.
      The reset swatch returns it to body text.
- [ ] Highlight does the same for the background.
- [ ] Colour some text, then toggle the theme: it stays legible in both, and the swatches
      themselves restyle. Reload — the colour survives and still follows the theme.
- [ ] With a swatch grid open, select different text: the grid closes rather than following
      the bar to its new position.
- [ ] Selecting inside a code block shows **no** format bar.
- [ ] Language picker changes highlighting and persists after reload.
- [ ] Delete a problem: first click arms, Cancel backs out, Delete removes it and returns
      to the table. The problem is gone after a restart.

## 6. Review flow

- [ ] Due Today lists only due problems.
- [ ] Review session: 0–5 selects, Enter confirms, Escape exits; progress advances and the
      summary appears at the end.
- [ ] `Show my notes` opens the current problem.
- [ ] Log review from the notes page updates next review, score and reps.
- [ ] Edit latest review changes score, date and reps, and replays scheduling from history.

## 7. Extension capture — the automation goal

Not yet verified against live LeetCode; PRD 9.15 checked a fixture page. This is the part
that matters most for the automated workflow.

```bash
pnpm --filter extension dev   # then load unpacked from apps/extension/.output/
```

- [ ] Open the extension's Options page and press **Connect to LeetBook**. A four-character
      code appears there, LeetBook raises "Allow LeetBook Capture to connect?" showing the
      **same** code, and approving completes the pairing. No token is copied anywhere.
- [ ] Deny once: the extension reports the refusal and does not pair.
- [ ] Press Connect with the app closed: it says LeetBook isn't running rather than hanging.
- [ ] Settings & Pairing shows a paired extension and no token. Disconnect, then confirm the
      extension has to pair again before the next capture lands.
- [ ] The sidebar has **four** items — no Capture tab. Settings & Pairing shows the setup steps
      while unpaired, and hides them once connected.
- [ ] Sidebar footer shows `Listener ready :7749`.
- [ ] Submit a real Accepted solution on leetcode.com. **A toast appears bottom-right.**
- [ ] Toast shows the real title, difficulty, runtime/memory, and **code saved** — not
      "code unavailable". Runtime and memory must match what LeetCode displays.
- [ ] Open the problem's notes page: the captured solution appears as a read-only code
      snapshot, syntax-highlighted for the submitted language, and complete rather than
      truncated. Try a long solution to be sure.
- [ ] Choosing a score creates or updates the problem in the app with a review and a code
      snapshot.
- [ ] Quit the app, submit again: the toast reports queued. Reopen the app; the queue
      flushes and the capture lands.
- [ ] Dismiss/skip schedules as Good.

### Capture — NeetCode

- [ ] Submit a real Accepted solution on neetcode.io. **A toast appears bottom-right**, with
      the runtime and memory NeetCode shows in the submission header ("Memory: 7.7 MB ·
      Time: 28ms") and **code saved**.
- [ ] The notes page shows the full solution, indentation intact — Python is unreadable
      otherwise.
- [ ] **The row is LeetCode's.** A problem NeetCode calls `two-integer-sum` must land on
      `two-sum`, with the LeetCode URL and LeetCode's difficulty and topics.
- [ ] Solve the same problem on both sites. There is **one** row with **two** reviews, not two
      rows. This is the acceptance test for the whole cross-site design.
- [ ] Rate a NeetCode-exclusive problem (one with no LeetCode counterpart): no toast, and the
      console explains that LeetCode could not confirm it. It must not create a row.
- [ ] Queue a NeetCode capture with the app closed, then reopen: the NeetCode tab's toast
      reports the flush, not just a LeetCode tab.

**If no toast appears at all**, check `fetchProblemMeta` first: it returns null on any
GraphQL failure and `offerCapture` then bails silently, which is indistinguishable from a
broken extension. That is the most likely failure and the first thing worth making
degrade gracefully.

Both failure modes now log to the LeetCode tab's console, prefixed `[LeetBook]`:

- **No toast at all** — metadata could not be read, so nothing was captured. Bailing is
  deliberate (difficulty and topics cannot be invented), but the warning says so.
- **Toast without a code snapshot** — the warning distinguishes a missing submission id in
  the URL from a `submissionDetails` call that returned nothing.
