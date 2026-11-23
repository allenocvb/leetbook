# LeetBook — manual QA checklist

Everything here needs a real `tauri dev` (or a release build). The automated gate covers
core logic, React behaviour and the extension adapter, but it runs in jsdom against a
Node SQLite shim — it cannot prove anything about the OS window, the platform opener,
native file dialogs, or a live LeetCode page.

Run before any release.

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

## 4. Table basics

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

## 5. Problem table

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

## 6. System design table

- [ ] The sidebar has **five** items; `System Design` sits after `Review Session`.
- [ ] Add a topic with a title, prompt and two tags. It appears without a reload.
- [ ] Tags typed as `Caching, caching` produce **one** chip, not two.
- [ ] Adding with an empty title is refused with a visible message.
- [ ] Search matches a word that appears only in a prompt, not in any title.
- [ ] Sorting by each column works and reverses on a second click.
- [ ] There is **no** Difficulty column.
- [ ] Delete a topic: it confirms in a dialog, disappears, and stays gone after a restart.
- [ ] Toggle dark mode: the table matches the problem table exactly.

## 7. System design topic notes

- [ ] Click a topic row: its notes page opens with the prompt shown behind a rule.
- [ ] A topic with an empty prompt shows no prompt block at all — not a dash, not a gap.
- [ ] Type notes: the status reads Saving… then Saved. Navigate away and back — they persist.
- [ ] Slash commands, code blocks and the selection colour bar all work, same as problem notes.
- [ ] Edit topic changes the title in the header without leaving the page.
- [ ] **Type something, then delete the topic without pausing.** It returns to the table and the
      topic is gone. Restart the app: it must still be gone, with no orphaned note behind it.
- [ ] The back link reads `← System Design` and returns to the table.

## 8. Design canvas

- [ ] Open a topic: the canvas appears below the notes, briefly showing `Loading canvas…`.
- [ ] Draw a few boxes and an arrow. Navigate away and back — the diagram is still there.
- [ ] Toggle dark mode: the canvas follows the app rather than staying light.
- [ ] Type in the notes **immediately after** drawing. Reload: both the prose and the diagram
      survived. Then draw immediately after typing and reload again. Neither may erase the other.
- [ ] Excalidraw's own menu offers no Open/Save-to-file/theme-toggle — the app owns those.
- [ ] **Offline font check.** Run `pnpm --filter desktop tauri build`, open the packaged app
      with wifi off, and draw some text. It must render in Excalidraw's handwriting font, not a
      fallback. This is the one thing `tauri dev` cannot tell you: unset, Excalidraw fetches its
      fonts from esm.sh, and a dev machine has network so it always looks fine.
- [ ] Check devtools Network on first canvas open: no request should leave the machine.

## 9. Notes editor

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

## 10. Review flow

- [ ] Due Today lists only due problems.
- [ ] Review session: 0–5 selects, Enter confirms, Escape exits; progress advances and the
      summary appears at the end.
- [ ] `Show my notes` opens the current problem.
- [ ] Log review from the notes page updates next review, score and reps.
- [ ] Edit latest review changes score, date and reps, and replays scheduling from history.

## 11. Extension capture — the automation goal

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

## 12. Capture — NeetCode

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

## 13. Quiz questions (authoring)

- [ ] A topic with no questions invites you to write one.
- [ ] Add a multiple-choice question, marking option 2. Reopen it: option 2 is still marked.
- [ ] **Fill options 2 and 3 only, leaving option 1 blank, and mark option 3.** Save, reopen:
      two options remain and the right one is still correct. Blank options are dropped on save,
      so the marked index has to move with them.
- [ ] Try to save a choice question with one option: it refuses and says why.
- [ ] Add a written-answer question: no options appear, and it is labelled Written.
- [ ] Edit and delete both kinds.

## 14. Design review session

- [ ] With nothing overdue, `Review due` says nothing is due rather than showing an empty session.
- [ ] A topic with no questions goes straight to the 0–5 picker.
- [ ] A topic **with** questions hides the picker until `Show answers` is pressed. Rating before
      seeing whether you were right is guesswork, and it feeds the schedule.
- [ ] Answer two multiple choice, one right and one wrong: after revealing, the right option is
      green, your wrong one is red, and the tally reads `1 of 2`.
- [ ] The tally never sets your score — the picker still starts empty.
- [ ] Written answers show the model answer only after revealing.
- [ ] Work through two topics: the progress bar advances and the summary counts match.
- [ ] Answers do not carry over between topics.
- [ ] The rating lands in the topic's history and pushes its next review out.

## 15. Due Today with design topics

- [ ] With no design topics due, Due Today looks exactly as before — no banner.
- [ ] With topics due, a banner sits above the table: "N system design topics are also due."
      One topic reads "topic is", not "topics are".
- [ ] `Review design` from the banner starts the design session.
- [ ] **The problems table still scrolls** under its sticky header with the banner present.
      The banner is a sibling of a page that takes `height: 100%`, so this is the thing most
      likely to have broken.

## 16. AI quiz — key storage

Needs `cd apps/desktop/src-tauri && cargo check` first; the keychain commands are Rust that
was written without a compiler available.

- [ ] Settings shows an **AI quiz** card reading "Off — no key set".
- [ ] It states plainly that generating questions sends notes to Anthropic, and that reviewing
      sends nothing.
- [ ] Paste a key and save. The card flips to "On", the field clears, and only a masked hint
      (`sk-ant…abcd`) is shown — never the whole key.
- [ ] Quit and reopen: the key is still set. It is **not** in the app-data database — open the
      `.db` in a SQLite browser and confirm it appears nowhere.
- [ ] Open Keychain Access, search `app.leetbook.desktop`: the entry exists and can be revoked
      by hand.
- [ ] Remove key: the card returns to "Off" and the Keychain entry is gone.

## 17. AI quiz — generating questions

Needs a key set in Settings. This is the only part of the app that sends your writing anywhere.

Use `docs/qa-fixtures/url-shortener-notes.md` for the topic and notes. A fixed fixture makes
generation comparable between runs — otherwise a prompt change and a different set of notes
are indistinguishable.

- [ ] A topic page shows **Generate with AI** beside `+ Add question`.
- [ ] With no key set, generating explains that and points at Settings — it does not fail obscurely.
- [ ] The dialog states, **before** you press Generate, that this topic's notes go to Anthropic
      and that nothing is saved until you review.
- [ ] A topic with no notes warns that questions will be generic.
- [ ] Generated drafts appear in full — prompt, every option with the correct one marked, and
      the explanation. Nothing is stored at this point: cancel, reopen the topic, and the
      question list is unchanged.
- [ ] Discard one: it dims, the count drops, and `Keep` restores it.
- [ ] Save: only the kept drafts appear in the list, and each can then be edited or deleted
      like a hand-written one.
- [ ] Watch devtools Network: one request on Generate, none while reviewing afterwards.

## 18. AI quiz — grading written answers

- [ ] With no key set, a written question offers **no** grading button.
- [ ] With a key set but nothing typed, still no button — there is nothing to grade and no
      reason to spend a request.
- [ ] Type an answer, Show answers, then **Grade my answers**. Per-question scores and
      reasoning appear.
- [ ] **The picker is still empty.** Nothing was chosen on your behalf, and Save stays disabled
      until you pick. This is the whole rule: the model suggests, you decide.
- [ ] `Use N` fills the picker with the suggestion. Saving stores that number.
- [ ] Ignore the suggestion and pick a different score. **That** number is what lands in the
      review log — check the topic's history afterwards.
- [ ] Pull the network and grade: it says grading failed and tells you to rate it yourself.
      The rating and Save still work. The optional part must never block the review.
- [ ] Deliberately write a weak answer and see whether the grader inflates it. A generous
      grader is the failure this design exists to contain — if it consistently overrates,
      tune `gradePrompt` in `apps/desktop/src/ai/anthropic.ts`.


## File library (Phase 17.1)

Automated: SQLite migration and independent duplicate filenames; import rollback; picker, search,
double-click and keyboard Open; Rust managed-path validation. Native acceptance still required:
upload a PDF and image, double-click both, move the originals and reopen the saved copies, relaunch
and confirm the rows persist. Drag files from Finder into the table. Check light/dark at 1280×820.


## Inline screenshots (Phase 17.2, November 22, 2026)

Automated checks cover image paste, browser drop, native-drop callback insertion, undo, restoring
saved image JSON with surrounding prose, invalid/oversized images, Markdown export and omission
of image bytes from quiz prompts. Rust tests cover bounded native file reading and path validation.

Browser verification at 1280×820 in light/dark used a disposable fixture with the real FilesPage
and NoteEditor: file table layout; image picker; successful decode/render; typing below the image;
reload and restore. No real user notes were changed. The macOS debug app bundle built successfully.
Native UI automation could not attach to the running dev executable and failed to launch/attach
to the bundle. **Native acceptance remains unverified:** Finder drop onto notes and library;
OS picker; default-app opening; persistence across a real desktop relaunch. Test those in Tauri,
not just the browser fixture. Include a Retina display to exercise physical/logical drop coordinates.
