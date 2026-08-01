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

## Acceptance for 14.2

Excalidraw must not appear in the entry chunk. After the canvas lands, the entry chunk should
stay within a few kB of 949 kB, and Excalidraw should show as its own lazily-fetched chunk.
A regression here means `React.lazy` is not doing what the code claims.
