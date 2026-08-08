import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies Excalidraw's bundled fonts into `public/` so they are served locally.
 *
 * Excalidraw resolves font files against `window.EXCALIDRAW_ASSET_PATH`, and when that is
 * unset it falls back to `https://esm.sh/@excalidraw/excalidraw@<version>/dist/prod/`. In a
 * packaged, offline desktop app that fetch fails and the handwriting fonts silently do not
 * load — and `tauri dev` never shows it, because a dev machine has network.
 *
 * Runs before dev and build. The copied directory is generated output, so it is gitignored.
 */
const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "../node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const target = join(here, "../public/excalidraw-assets/fonts");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(source))) {
  // Not an error: the dependency may simply not be installed yet.
  console.warn("[excalidraw] fonts not found at %s — run pnpm install", source);
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
console.log("[excalidraw] fonts copied to public/excalidraw-assets/fonts");
