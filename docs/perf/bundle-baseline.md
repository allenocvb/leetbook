# Desktop bundle sizes

Recorded from `pnpm --filter desktop build` so the lazy-loading claim in PRD 14.2 is checkable
rather than asserted. Re-measure whenever a heavy dependency lands.

## Before Excalidraw (commit c5ebb98, Phase 13 complete)

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 949.14 kB | 296.20 kB |
| `index-*.css` | 43.51 kB | 8.13 kB |
| Fonts (14 files) | ~312 kB | — |

The entry chunk is the number that matters: it is parsed on every launch, including by
someone who never opens a design topic.

## After Excalidraw (Phase 14)

| Chunk | Raw | Change |
|---|---|---|
| entry `index-*.js` | 953.79 kB | **+4.65 kB** |
| Excalidraw (lazy) | 690.57 kB | new, fetched on first canvas |
| Mermaid / cytoscape / font subsetting (lazy) | ~4 MB across several chunks | new, fetched by Excalidraw on demand |

The entry chunk grew by under 2 kB — the `React.lazy` boundary in `DesignCanvas.tsx` is doing
its job. Total on-disk output grows a lot, but none of it is parsed at launch, and a user who
never opens a design topic never downloads any of it.

## Acceptance for 14.2

Excalidraw must not appear in the entry chunk. The entry chunk should stay within a few kB of
949 kB. A jump of hundreds of kB means the lazy boundary has been bypassed — usually by
someone importing `ExcalidrawCanvas` directly instead of `DesignCanvas`.

To re-check: `pnpm --filter desktop build`, then find the `.js` referenced from
`dist/index.html` and compare its size.
