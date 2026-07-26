import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

/** Save-dialog + write. Returns the chosen path, or null if the user cancelled. */
export async function saveTextFile(defaultName: string, contents: string): Promise<string | null> {
  const path = await save({ defaultPath: defaultName });
  if (!path) return null;
  await writeTextFile(path, contents);
  return path;
}

/** Directory picker. Returns the chosen directory, or null if cancelled. */
export async function pickDirectory(): Promise<string | null> {
  const path = await open({ directory: true });
  return typeof path === "string" ? path : null;
}

export async function writeFileIn(dir: string, name: string, contents: string): Promise<void> {
  await writeTextFile(`${dir}/${name}`, contents);
}
