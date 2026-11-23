import { invoke } from "@tauri-apps/api/core";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function imageDataUrl(file: File): Promise<string> {
  if (!MIME_TYPES.has(file.type))
    return Promise.reject(new Error("Use a PNG, JPEG, GIF, or WebP image."));
  if (file.size > MAX_IMAGE_BYTES)
    return Promise.reject(new Error("Images must be 10 MB or smaller."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const src = String(reader.result);
      // Decode before saving: an extension alone doesn't prove the file contains an image.
      const image = new Image();
      image.onload = () => resolve(src);
      image.onerror = () => reject(new Error(`${file.name} is not a readable image.`));
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export async function nativeImage(path: string): Promise<File> {
  const name = path.split(/[\\/]/).pop() ?? "Screenshot";
  const extension = name.split(".").pop()?.toLowerCase();
  const type = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  if (!MIME_TYPES.has(type)) throw new Error("Use a PNG, JPEG, GIF, or WebP image.");
  const bytes = await invoke<number[]>("read_note_image", { path });
  return new File([new Uint8Array(bytes)], name, { type });
}
