# LeetBook — what it is and how it works

A guided tour of the product and the codebase. For contributing rules see
[`AGENTS.md`](../AGENTS.md); for what to build next see [`docs/PRD.md`](./PRD.md).

---

## The problem

Spaced repetition works, but the tooling around LeetCode practice is bad at it. Notion tables
need a row edited by hand after every solve, so the data rots. LeetCode's own notes are weak,
and neither knows when you should see a problem again.

LeetBook keeps the practice log honest without asking you to maintain it: solve on LeetCode,
rate your recall once, and the schedule takes care of itself.

## Features

**Spaced repetition that adapts.** Every solve is rated 0–5 and FSRS picks the next review
date from your actual recall history — not a fixed ladder. Getting something right pushes it
weeks out; forgetting it pulls it back to days.

**Automatic capture.** A browser extension notices an Accepted submission on leetcode.com and
offers a 0–5 toast in the corner. Rating it creates or updates the problem in the app with the
submitted code, language, runtime and memory attached. You never retype a problem. NeetCode is
the next source in (Phase 12).

**Notes worth rereading.** A Notion-style editor per problem: headings, lists, quotes, a purple
recall callout for the one insight you want to remember, and syntax-highlighted code blocks
that behave like a code editor (Tab indents, Enter preserves indentation). Selecting text
raises a formatting bar with text and highlight colours. Captured solutions appear as read-only
snapshots alongside your own notes.

**Honest derived state.** Status (New / Learning / Mastered / Leech), due-ness and table columns
are computed from the review log at read time, never stored. The log is append-only, with one
explicit correction path for the latest review.

**Your data stays yours.** Local SQLite, no accounts, no servers, no telemetry. Notion CSV
import to get started, JSON and Markdown export to leave.

## The rubric

The 0–5 score is the interface; FSRS speaks a four-point scale underneath.

| Score | Meaning | FSRS |
|---|---|---|
| 0 | Complete blackout | Again |
| 1 | Incorrect, but familiar once seen | Again |
| 2 | Incorrect, knew the approach after a hint | Hard |
| 3 | Correct, with significant struggle | Good |
| 4 | Correct after some hesitation | Good |
| 5 | Perfect recall, smooth and confident | Easy |

3 and 4 schedule identically — the distinction is kept for your own history. Rating honestly
matters more than any setting: a 5 on something that took real thought will push the interval
out much further than your memory deserves.

---

## Architecture

```
leetbook/
├── packages/core      pure TypeScript — schema, FSRS, data access, import/export
├── apps/desktop       Tauri 2 + React shell over core
└── apps/extension     MV3 browser extension (WXT), leetcode.com content script
```

### packages/core

All business logic, ~1,400 lines, one runtime dependency (`ts-fsrs`). It never imports from
apps and never touches a database driver directly — platforms inject a `SqlExecutor`:

```ts
interface SqlExecutor {
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  select<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}
```

The desktop app supplies one backed by `tauri-plugin-sql`; tests supply one backed by Node's
built-in SQLite. That seam is why core is testable without a browser or a Tauri shell, and why
a future web build would be a port rather than a rewrite.

### Data model

```
problems    (id, slug, title, url, difficulty, tags[], created_at)
reviews     (id, problem_id, score 0–5, reviewed_at, runtime, memory, language, code_snapshot)
scheduling  (problem_id, fsrs_card, due_at, review_count, last_reviewed_at)
notes       (problem_id, content_json, updated_at)
```

Migrations are versioned and forward-only, executed as raw SQL through the injected executor.

Two things about `scheduling` that look like violations of "derived data is never stored" and
are not: `fsrs_card` is FSRS's own state, which cannot be recomputed without it, and
`review_count` is a counter that legitimately exceeds the number of review rows — a Notion
import brings six reps with one review.

### apps/desktop

React over core, with only six modules touching Tauri: the SQL executor and its boot, the file
dialogs, the external-link opener, the capture listener hook, and the window chrome. Everything
else is platform-agnostic React.

The window is decorated and uses macOS's own controls, so the OS owns corners, shadow and the
green button's Move/Resize/Tile menu. The app draws no window buttons.

### apps/extension

One content script and a background relay.

Every practice site implements the `CaptureSource` contract in `capture/source.ts`: match a
URL, find the slug, recognise an Accepted verdict, read the metadata, read the submission.
Everything downstream — the toast, the offline queue, the relay, the desktop listener — is
source-agnostic. **All LeetCode knowledge lives in `capture/adapter.ts`**: the DOM locator for
the verdict, the GraphQL queries, the URL shapes. When LeetCode changes, that file breaks and
nothing else does, and it has its own tests. NeetCode arrives as a sibling adapter in Phase 12.

Capture reads the submission from LeetCode's authenticated `submissionDetails` API rather than
scraping: the editor buffer is not in `localStorage`, and Monaco virtualises its lines, so DOM
scraping silently truncates long solutions.

### The bridge

The desktop app runs a small HTTP listener on `127.0.0.1:7749` (Rust, `tiny_http`). The
extension pairs by **approval, not a copied token**:

1. Extension `POST /pair/request` — unauthenticated, because asking for a token is the point
2. App raises *"Allow LeetBook Capture to connect?"* showing a four-character code the
   extension is also displaying
3. On approval, the extension's poll of `GET /pair/status` returns the token

Requests expire after two minutes, a newer one supersedes an older one, and dismissing counts
as a denial. Afterwards every capture carries the token in `x-leetbook-token`. If the app is
closed, captures queue in extension storage and flush on reconnect.

## Stack and tooling

| | |
|---|---|
| Language | TypeScript, strict |
| Desktop | Tauri 2 (Rust shell) + React 19 + Vite |
| Editor | TipTap 3 (ProseMirror) + lowlight |
| Scheduling | `ts-fsrs`, fuzz disabled for determinism |
| Storage | SQLite via `tauri-plugin-sql` |
| Extension | WXT, Manifest V3 |
| Monorepo | pnpm workspaces + Turborepo |
| Lint/format | Biome |
| Tests | Vitest + Testing Library, `cargo test` for the listener |

## Testing philosophy

Business logic lives in core so it can be tested without a browser or a Tauri shell. UI tests
assert what a user sees and does, not implementation details.

The suite runs in jsdom against a Node SQLite shim, which means **a green suite proves nothing
about the OS window, the platform opener, native dialogs, or a live LeetCode page**. Those are
covered by [`docs/QA.md`](./QA.md), worked through by hand before a release. Several real bugs
have hidden behind a green suite; the checklist exists because of them.

## Known limitations

- macOS only in practice. Nothing is deliberately platform-specific except the titlebar inset,
  but nothing else has been tested.
- The extension is loaded unpacked; it is not in the Chrome Web Store yet.
- Capture depends on LeetCode's page and API staying put. The blast radius is one file.
- Only LeetCode is captured today. Solving in NeetCode's own editor records nothing.
- Imported problems arrive with their original due dates, so a Notion import can land entirely
  overdue.
