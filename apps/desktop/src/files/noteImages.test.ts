import { expect, it } from "vitest";
import { imageDataUrl, MAX_IMAGE_BYTES } from "./noteImages.js";

it("rejects non-images and oversized screenshots before reading them", async () => {
  await expect(
    imageDataUrl(new File(["text"], "notes.txt", { type: "text/plain" })),
  ).rejects.toThrow("PNG, JPEG");
  const file = new File(["small"], "huge.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: MAX_IMAGE_BYTES + 1 });
  await expect(imageDataUrl(file)).rejects.toThrow("10 MB");
});
