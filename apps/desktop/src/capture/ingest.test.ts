import { createProblemsRepo, createReviewsRepo, createSchedulingRepo } from "@leetbook/core";
import { describe, expect, it } from "vitest";
import { makeDb } from "../test-utils.js";
import { ingestCapture } from "./ingest.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

const VALID = JSON.stringify({
  version: 1,
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "easy",
  tags: ["Array", "Hash Table"],
  score: 4,
  runtimeMs: 61,
  memoryMb: 18.4,
  language: "python3",
  codeSnapshot: "def twoSum(self): ...",
  capturedAt: NOW.toISOString(),
});

describe("ingestCapture", () => {
  it("creates the problem, review, and scheduling from a capture", async () => {
    const db = await makeDb();
    const result = await ingestCapture(db, VALID, NOW);
    expect(result).toEqual({
      ok: true,
      slug: "two-sum",
      title: "Two Sum",
      reviewedAt: NOW.toISOString(),
    });

    const problem = await createProblemsRepo(db).getBySlug("two-sum");
    expect(problem?.title).toBe("Two Sum");
    expect(problem?.tags).toEqual(["Array", "Hash Table"]);

    const [review] = await createReviewsRepo(db).listByProblem(problem?.id ?? "");
    expect(review?.score).toBe(4);
    expect(review?.runtimeMs).toBe(61);
    expect(review?.codeSnapshot).toContain("twoSum");

    const state = await createSchedulingRepo(db).get(problem?.id ?? "");
    expect(state?.reviewCount).toBe(1);
    expect(new Date(state?.dueAt ?? 0).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("re-capture of the same slug appends a review without duplicating the problem", async () => {
    const db = await makeDb();
    await ingestCapture(db, VALID, NOW);
    await ingestCapture(db, VALID, new Date("2026-07-30T12:00:00.000Z"));

    const problems = await createProblemsRepo(db).listAll();
    expect(problems).toHaveLength(1);
    expect(await createReviewsRepo(db).listByProblem(problems[0]?.id ?? "")).toHaveLength(2);
    expect((await createSchedulingRepo(db).get(problems[0]?.id ?? ""))?.reviewCount).toBe(2);
  });

  it.each([
    ["not json at all", "payload is not valid JSON"],
    [
      JSON.stringify({ slug: "Bad Slug!", title: "X", difficulty: "easy", score: 3 }),
      "invalid slug",
    ],
    [JSON.stringify({ slug: "ok", title: "", difficulty: "easy", score: 3 }), "missing title"],
    [
      JSON.stringify({ slug: "ok", title: "X", difficulty: "extreme", score: 3 }),
      "invalid difficulty",
    ],
    [JSON.stringify({ slug: "ok", title: "X", difficulty: "easy", score: 9 }), "invalid score"],
  ])("rejects bad payloads (%s)", async (payload, expectedError) => {
    const db = await makeDb();
    const result = await ingestCapture(db, payload, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(expectedError);
    expect(await createProblemsRepo(db).listAll()).toHaveLength(0);
  });
});
