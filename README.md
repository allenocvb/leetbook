# LeetBook

Spaced repetition and notebook-style notes for LeetCode — local-first, open source, no accounts.

A desktop app (Tauri 2) that tracks your LeetCode practice with FSRS scheduling and Notion-style
notes, plus a browser extension that captures Accepted submissions automatically so you never
retype a problem again.

> **Status:** early scaffold. Nothing to see yet — see `docs/` for the design doc.

## Structure

```
leetbook/
├── packages/core      # pure TypeScript: schema, FSRS scheduling, data access
├── apps/desktop       # Tauri 2 + React desktop app
└── apps/extension     # MV3 browser extension (WXT)
```

## Development

Requires Node ≥ 22, [pnpm](https://pnpm.io), and (for the desktop app) the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm lint        # biome
pnpm typecheck
pnpm test
pnpm build       # builds core, extension, and the desktop frontend
pnpm --filter desktop tauri dev   # run the desktop app
```

## License

[MIT](./LICENSE)
