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

## 1. Window shell — highest risk

These depend on `transparent: true` + `macOSPrivateApi` and the Tauri capability list.
The config validates against the Tauri 2 schema, but only a build proves the behaviour.

- [ ] Window has **rounded corners** when not fullscreen. If corners are square or show
      black/white notches, back out `transparent`/`shadow`/`macOSPrivateApi` from
      `tauri.conf.json` and the radius from `.app-window` — that change is self-contained.
- [ ] Window has a **drop shadow** against the desktop.
- [ ] **No desk border.** The app content reaches every edge; there is no lavender frame
      and no second window inside the window.
- [ ] **Dragging the titlebar moves the window** (needs `core:window:allow-start-dragging`;
      this failed silently before, while resizing still worked).
- [ ] Resize from an edge still works, down to the 800×600 minimum.
- [ ] **Green control enters fullscreen** and the macOS menu bar and Dock hide. Corners go
      square in fullscreen. Exiting restores the rounded window.
- [ ] Red closes, amber minimises.
- [ ] Traffic lights are neutral grey at rest; hovering anywhere in the cluster reveals all
      three in muted red/amber/green — not the bright macOS hues.
- [ ] Theme toggle switches light/dark and **survives a restart**.

## 2. Data and persistence

- [ ] First launch shows the intro; `Le(e)t's Code` opens All Problems; the intro does not
      reappear on the next launch.
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
- [ ] Clicking anywhere in a row opens notes; the arrow is decorative, not a second target.
- [ ] Comfortable/compact density.

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
- [ ] Typing `l` at the start of a code line is **not** auto-capitalised; quotes stay
      straight, `--` is not turned into an en dash.
- [ ] `/` inside a code block does not open the slash menu.
- [ ] Language picker changes highlighting and persists after reload.
- [ ] Delete a problem: first click arms, Cancel backs out, Delete removes it and returns
      to the table. The problem is gone after a restart.

## 6. Review flow

- [ ] Due Today lists only due problems.
- [ ] Review session: 0–5 selects, Enter confirms, Escape exits; progress advances and the
      summary appears at the end.
- [ ] `Show my notes` opens the current problem.
- [ ] Log review from the notes page updates next review, score and reps.
- [ ] Correct latest score changes only that review and replays scheduling.

## 7. Extension capture — the automation goal

Not yet verified against live LeetCode; PRD 9.15 checked a fixture page. This is the part
that matters most for the automated workflow.

```bash
pnpm --filter extension dev   # then load unpacked from apps/extension/.output/
```

- [ ] Paste the pairing token from Settings into the extension options page; it reports the
      app is reachable.
- [ ] Sidebar footer shows `Listener ready :7749`.
- [ ] Submit a real Accepted solution on leetcode.com. **A toast appears bottom-right.**
- [ ] Toast shows the real title, difficulty, runtime/memory, and code status.
- [ ] Choosing a score creates or updates the problem in the app with a review and a code
      snapshot.
- [ ] Quit the app, submit again: the toast reports queued. Reopen the app; the queue
      flushes and the capture lands.
- [ ] Dismiss/skip schedules as Good.

**If no toast appears at all**, check `fetchProblemMeta` first: it returns null on any
GraphQL failure and `offerCapture` then bails silently, which is indistinguishable from a
broken extension. That is the most likely failure and the first thing worth making
degrade gracefully.
