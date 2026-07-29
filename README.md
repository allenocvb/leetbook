# LeetBook

Spaced repetition and notebook-style notes for LeetCode — local-first, open source, no accounts.

A desktop app (Tauri 2) that tracks your practice with FSRS scheduling and Notion-style notes,
plus a browser extension that captures Accepted submissions automatically so you never retype a
problem again.

> **Status:** v1 foundation, pre-release. Scheduling, local SQLite, the desktop views, notes,
> review sessions, import/export and extension capture all work. Not yet signed or packaged, so
> for now you run it from source. See [`docs/PRD.md`](./docs/PRD.md) for what's next.

**New here?** [`docs/OVERVIEW.md`](./docs/OVERVIEW.md) explains what the app does and how it's
put together.

---

## What you need

| | |
|---|---|
| **Node** | 22 or newer — `node -v` |
| **pnpm** | 11 or newer — `npm i -g pnpm` |
| **Rust** | stable, for the desktop shell — [rustup.rs](https://rustup.rs) |
| **Xcode CLI tools** | macOS only — `xcode-select --install` |

Full platform-by-platform requirements are in the
[Tauri prerequisites](https://tauri.app/start/prerequisites/). macOS is the only platform
tested so far.

## Getting started

```bash
git clone https://github.com/allenocvb/leetbook.git
cd leetbook
pnpm install
pnpm --filter desktop tauri dev
```

The first `tauri dev` compiles the Rust shell and takes a few minutes. Later runs start in
seconds. The app window opens on its own; leave the command running while you use it.

On first launch you get an intro screen, then an empty problem table. From there:

- **Add a problem by hand** — `+ Add problem` in the table header
- **Bring your Notion table across** — Settings → Import → pick your CSV export
- **Let the extension do it** — see below

Your database lives in the OS application-data directory (on macOS,
`~/Library/Application Support/app.leetbook.desktop/`). Deleting that folder resets the app.

### Setting up the extension

The extension watches leetcode.com and offers you a 0–5 rating when a submission is Accepted.

```bash
pnpm --filter extension dev
```

That launches a **separate** Chrome profile with the extension already loaded — a clean window
with none of your tabs, extensions or logins, which is deliberate for development. To use your
normal browser instead, build it and load it yourself:

```bash
pnpm --filter extension build
# Chrome → chrome://extensions → Developer mode on
#        → Load unpacked → apps/extension/.output/chrome-mv3
```

Then pair it, with the desktop app running:

1. Solve anything on leetcode.com and submit until it's Accepted
2. The extension asks the app for permission and shows a four-character code
3. The app raises *"Allow LeetBook Capture to connect?"* with the same code — approve it
4. The rating toast appears bottom-right; pick 0–5 and the problem lands in the app

Pairing is once per browser. Requests expire after two minutes; if you miss it, submit again.

If the toast never appears, check the app is running and that the extension is enabled for
leetcode.com. Captures made while the app is closed queue up and flush when it reopens.

---

## Commands

Run these from the repository root.

### Running things

```bash
pnpm --filter desktop tauri dev    # the desktop app (what you normally want)
pnpm --filter desktop dev          # frontend only, in a browser — no SQLite, no capture
pnpm --filter extension dev        # extension in a dev Chrome profile
```

### Checks

```bash
pnpm lint          # Biome — formatting, lint, accessibility
pnpm typecheck     # tsc --noEmit across all three workspaces
pnpm test          # Vitest across all three workspaces
```

Before you push, run all three plus the Rust check:

```bash
pnpm lint && pnpm typecheck && pnpm test
cd apps/desktop/src-tauri && cargo check && cargo test
```

**Read the output rather than the exit code of a pipe.** Piping through `tail` or `head`
returns *that* command's status, so a failing gate can look green. This has bitten this repo
before.

### Narrower runs

```bash
pnpm --filter @leetbook/core test             # one workspace
pnpm --filter desktop test -- NoteEditor      # one file, by name substring
pnpm --filter desktop exec vitest             # watch mode
pnpm lint:fix                                 # apply Biome's safe fixes
```

### Building

```bash
pnpm build                          # core + extension + desktop frontend
pnpm --filter desktop tauri build   # a real .app bundle (unsigned)
pnpm --filter extension zip         # a store-ready extension zip
```

`tauri build` produces `apps/desktop/src-tauri/target/release/bundle/macos/LeetBook.app`. It is
unsigned, so Gatekeeper blocks the first launch — right-click the app and choose **Open**, then
confirm. After that it opens normally, and you can drag it to `/Applications` and keep it in
the Dock like any other app. Signed and notarized builds need an Apple Developer account and
are tracked as Phase 10.

---

## Troubleshooting

**`tauri dev` fails to compile Rust.** Make sure `rustup` is on a stable toolchain
(`rustup default stable`) and Xcode CLI tools are installed. `cargo clean` in
`apps/desktop/src-tauri` clears a corrupted build cache.

**`pnpm install` errors about optional native binaries.** Delete `node_modules` and the
lockfile-adjacent caches with `pnpm store prune`, then install again. Rollup and esbuild ship
per-platform binaries that go missing after a Node upgrade.

**Tests pass but the app misbehaves.** Expected. The suite runs in jsdom and cannot see the OS
window, native dialogs, external links, or a live LeetCode page. Work through
[`docs/QA.md`](./docs/QA.md) by hand for those.

**Extension captures nothing.** Open the page's devtools console and look for `[LeetBook]`
lines. Capture depends on LeetCode's own submission API, so if they change it,
`apps/extension/capture/adapter.ts` is the single file that needs updating. Note that only
leetcode.com is captured today — solving inside NeetCode's editor records nothing yet.

---

## Documentation

| | |
|---|---|
| [`docs/OVERVIEW.md`](./docs/OVERVIEW.md) | What the app does, how it's built |
| [`docs/PRD.md`](./docs/PRD.md) | Roadmap and task breakdown |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Product and technical decisions |
| [`docs/UI_SPEC.md`](./docs/UI_SPEC.md) | Visual and interaction contract |
| [`docs/QA.md`](./docs/QA.md) | Manual checklist for what tests can't reach |
| [`AGENTS.md`](./AGENTS.md) | Contribution workflow and conventions |

## License

[MIT](./LICENSE)
