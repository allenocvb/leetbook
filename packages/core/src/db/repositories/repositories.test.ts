import { beforeEach, describe, expect, it } from "vitest";
import { scheduleReview } from "../../fsrs.js";
import type { SqlExecutor } from "../executor.js";
import { migrate } from "../migrate.js";
import { createTestDb } from "../test-helpers.js";
import { createNotesRepo } from "./notes.js";
import { createProblemsRepo, type ProblemInput } from "./problems.js";
import { createReviewsRepo } from "./reviews.js";
import { createSchedulingRepo } from "./scheduling.js";

const NOW = new Date("2026-07-25T12:00:00.000Z");

const TWO_SUM: ProblemInput = {
  slug: "two-sum",
  title: "Two Sum",
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "easy",
  tags: ["Array", "Hash Table"],
};

let db: SqlExecutor;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
});

describe("problems repo", () => {
  it("inserts and reads back a problem", async () => {
    const repo = createProblemsRepo(db);
    const stored = await repo.upsertBySlug(TWO_SUM, NOW);
    expect(stored.slug).toBe("two-sum");
    expect(stored.tags).toEqual(["Array", "Hash Table"]);
    expect(await repo.getById(stored.id)).toEqual(stored);
  });

  it("upsert by slug updates metadata but keeps id and createdAt", async () => {
    const repo = createProblemsRepo(db);
    const first = await repo.upsertBySlug(TWO_SUM, NOW);
    const second = await repo.upsertBySlug(
      { ...TWO_SUM, title: "Two Sum (updated)", tags: ["Array"] },
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.title).toBe("Two Sum (updated)");
    expect(await repo.listAll()).toHaveLength(1);
  });

  it("updates editable metadata by id without detaching derived history", async () => {
    const problems = createProblemsRepo(db);
    const reviews = createReviewsRepo(db);
    const scheduling = createSchedulingRepo(db);
    const notes = createNotesRepo(db);
    const original = await problems.upsertBySlug(TWO_SUM, NOW);
    const review = await reviews.add({
      problemId: original.id,
      score: 4,
      reviewedAt: NOW.toISOString(),
      runtimeMs: null,
      memoryMb: null,
      language: null,
      codeSnapshot: null,
    });
    const schedule = scheduleReview(null, original.id, 4, NOW);
    await scheduling.put(schedule);
    const note = await notes.put(original.id, '{"type":"doc","content":[]}', NOW);

    const updated = await problems.update(original.id, {
      slug: "two-sum-ii",
      title: "Two Sum II",
      url: "https://leetcode.com/problems/two-sum-ii/",
      difficulty: "medium",
      tags: ["Array", "Two Pointers"],
    });

    expect(updated).toMatchObject({
      id: original.id,
      slug: "two-sum-ii",
      title: "Two Sum II",
      difficulty: "medium",
      tags: ["Array", "Two Pointers"],
      createdAt: original.createdAt,
    });
    expect(await problems.getBySlug("two-sum")).toBeNull();
    expect(await reviews.listByProblem(original.id)).toEqual([review]);
    expect(await scheduling.get(original.id)).toEqual(schedule);
    expect(await notes.get(original.id)).toEqual(note);
  });

  it("rejects an edit that would duplicate another problem slug", async () => {
    const repo = createProblemsRepo(db);
    const first = await repo.upsertBySlug(TWO_SUM, NOW);
    await repo.upsertBySlug(
      {
        ...TWO_SUM,
        slug: "three-sum",
        title: "3Sum",
        url: "https://leetcode.com/problems/3sum/",
      },
      NOW,
    );

    await expect(
      repo.update(first.id, {
        ...TWO_SUM,
        slug: "three-sum",
        url: "https://leetcode.com/problems/three-sum/",
      }),
    ).rejects.toThrow();
    expect(await repo.getById(first.id)).toEqual(first);
  });

  it("listAll orders by title", async () => {
    const repo = createProblemsRepo(db);
    await repo.upsertBySlug({ ...TWO_SUM, slug: "zigzag", title: "Zigzag Conversion" }, NOW);
    await repo.upsertBySlug(TWO_SUM, NOW);
    const titles = (await repo.listAll()).map((p) => p.title);
    expect(titles).toEqual(["Two Sum", "Zigzag Conversion"]);
  });
});

describe("reviews repo", () => {
  it("appends and lists reviews in chronological order", async () => {
    const problems = createProblemsRepo(db);
    const reviews = createReviewsRepo(db);
    const problem = await problems.upsertBySlug(TWO_SUM, NOW);

    await reviews.add({
      problemId: problem.id,
      score: 3,
      reviewedAt: "2026-07-01T00:00:00.000Z",
      runtimeMs: 61,
      memoryMb: 18.4,
      language: "python3",
      codeSnapshot: "def twoSum(...): ...",
    });
    await reviews.add({
      problemId: problem.id,
      score: 5,
      reviewedAt: "2026-07-20T00:00:00.000Z",
      runtimeMs: null,
      memoryMb: null,
      language: null,
      codeSnapshot: null,
    });

    const all = await reviews.listByProblem(problem.id);
    expect(all.map((r) => r.score)).toEqual([3, 5]);
    expect(all[0]?.runtimeMs).toBe(61);
    expect(await reviews.latestScores(problem.id, 1)).toEqual([5]);
  });
});

describe("scheduling repo", () => {
  it("round-trips FSRS state through the database", async () => {
    const problems = createProblemsRepo(db);
    const scheduling = createSchedulingRepo(db);
    const problem = await problems.upsertBySlug(TWO_SUM, NOW);

    const state = scheduleReview(null, problem.id, 4, NOW);
    await scheduling.put(state);
    const loaded = await scheduling.get(problem.id);
    expect(loaded).toEqual(state);

    // applying the next review from the loaded state must work
    const next = scheduleReview(loaded, problem.id, 5, new Date(state.dueAt));
    await scheduling.put(next);
    expect((await scheduling.get(problem.id))?.reviewCount).toBe(2);
  });

  it("listDueBy returns only due states, soonest first", async () => {
    const problems = createProblemsRepo(db);
    const scheduling = createSchedulingRepo(db);
    const a = await problems.upsertBySlug(TWO_SUM, NOW);
    const b = await problems.upsertBySlug({ ...TWO_SUM, slug: "lru-cache", title: "LRU" }, NOW);

    const dueState = scheduleReview(null, a.id, 0, new Date("2026-07-01T00:00:00.000Z"));
    const farState = scheduleReview(null, b.id, 5, NOW);
    await scheduling.put(dueState);
    await scheduling.put(farState);

    const due = await scheduling.listDueBy(NOW.toISOString());
    expect(due.map((s) => s.problemId)).toEqual([a.id]);
  });
});

describe("notes repo", () => {
  it("puts and gets, and put overwrites", async () => {
    const problems = createProblemsRepo(db);
    const notes = createNotesRepo(db);
    const problem = await problems.upsertBySlug(TWO_SUM, NOW);

    await notes.put(problem.id, '{"type":"doc","content":[]}', NOW);
    const updated = await notes.put(problem.id, '{"type":"doc","content":[1]}', NOW);
    expect(updated.contentJson).toContain("[1]");
    expect((await notes.get(problem.id))?.contentJson).toContain("[1]");
    expect(await notes.get("missing")).toBeNull();
  });
});
