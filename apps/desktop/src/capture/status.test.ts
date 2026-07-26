import { describe, expect, it } from "vitest";
import { makeDb } from "../test-utils.js";
import { ingestCapture } from "./ingest.js";
import { loadLastCapture } from "./status.js";

const CAPTURE = JSON.stringify({
  version: 1,
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "easy",
  tags: ["Array"],
  score: 4,
  runtimeMs: 61,
  memoryMb: 18.4,
  language: "typescript",
  codeSnapshot: "return indices;",
  capturedAt: "2026-07-25T12:00:00.000Z",
});

describe("loadLastCapture", () => {
  it("returns the latest review that carries extension submission data", async () => {
    const db = await makeDb();
    await ingestCapture(db, CAPTURE, new Date("2026-07-25T12:00:00.000Z"));

    expect(await loadLastCapture(db)).toEqual({
      slug: "two-sum",
      title: "Two Sum",
      reviewedAt: "2026-07-25T12:00:00.000Z",
    });
  });

  it("returns null when no extension capture has been recorded", async () => {
    expect(await loadLastCapture(await makeDb())).toBeNull();
  });
});
