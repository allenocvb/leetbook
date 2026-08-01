import { beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./db/executor.js";
import { migrate } from "./db/migrate.js";
import { createDesignNotesRepo } from "./db/repositories/designNotes.js";
import {
  createDesignReviewsRepo,
  createDesignSchedulingRepo,
} from "./db/repositories/designReviews.js";
import { createDesignTopicsRepo, normalizeTopicTags } from "./db/repositories/designTopics.js";
import { createProblemsRepo } from "./db/repositories/problems.js";
import { createTestDb } from "./db/test-helpers.js";
import { applyDesignReview, previewDesignReview } from "./designReview.js";
import { scheduleReview } from "./fsrs.js";
import { applyReview } from "./review.js";
import { listDesignTableRows, listDueDesignRows } from "./views/designTable.js";

const NOW = new Date("2026-08-01T09:00:00.000Z");

let db: SqlExecutor;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
});

const addTopic = (overrides: Partial<{ title: string; prompt: string; tags: string[] }> = {}) =>
  createDesignTopicsRepo(db).add(
    {
      title: "URL shortener",
      prompt: "Design a URL shortener for 100M links/day.",
      tags: ["Caching", "Sharding"],
      ...overrides,
    },
    NOW,
  );

describe("normalizeTopicTags", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTopicTags(["  Caching ", "Load   Balancing"])).toEqual([
      "Caching",
      "Load Balancing",
    ]);
  });

  it("drops duplicates that differ only by case, keeping the first spelling", () => {
    // The duplication problem the canonical LeetCode list exists to solve, minus the taxonomy.
    expect(normalizeTopicTags(["Caching", "caching", "CACHING"])).toEqual(["Caching"]);
  });

  it("drops empty tags and preserves the user's ordering", () => {
    expect(normalizeTopicTags(["Sharding", "", "   ", "Caching"])).toEqual(["Sharding", "Caching"]);
  });
});

describe("design topics repo", () => {
  it("stores and reads back a topic", async () => {
    const topic = await addTopic();
    expect(topic).toMatchObject({
      title: "URL shortener",
      prompt: "Design a URL shortener for 100M links/day.",
      tags: ["Caching", "Sharding"],
      createdAt: NOW.toISOString(),
    });
    expect(await createDesignTopicsRepo(db).getById(topic.id)).toEqual(topic);
  });

  it("allows two topics with the same title", async () => {
    // Unlike problems there is no slug, so nothing should be rejected as a duplicate.
    await addTopic();
    await addTopic();
    expect(await createDesignTopicsRepo(db).listAll()).toHaveLength(2);
  });

  it("updates editable metadata without changing the id or created date", async () => {
    const repo = createDesignTopicsRepo(db);
    const topic = await addTopic();

    const updated = await repo.update(topic.id, {
      title: "Rate limiter",
      prompt: "Design a rate limiter.",
      tags: ["Throttling", "throttling"],
    });

    expect(updated.id).toBe(topic.id);
    expect(updated.createdAt).toBe(topic.createdAt);
    expect(updated.title).toBe("Rate limiter");
    expect(updated.tags).toEqual(["Throttling"]);
  });

  it("removes a topic and everything derived from it", async () => {
    const repo = createDesignTopicsRepo(db);
    const topic = await addTopic();
    await applyDesignReview(db, { topicId: topic.id, score: 4 }, NOW);
    await createDesignNotesRepo(db).put(topic.id, '{"type":"doc"}', NOW);

    await repo.remove(topic.id);

    expect(await repo.getById(topic.id)).toBeNull();
    expect(await createDesignReviewsRepo(db).listByTopic(topic.id)).toEqual([]);
    expect(await createDesignSchedulingRepo(db).get(topic.id)).toBeNull();
    expect(await createDesignNotesRepo(db).get(topic.id)).toBeNull();
  });
});

describe("design notes repo", () => {
  it("replaces the note rather than appending a second one", async () => {
    const topic = await addTopic();
    const notes = createDesignNotesRepo(db);

    await notes.put(topic.id, '{"type":"doc","content":[]}', NOW);
    const later = new Date("2026-08-02T09:00:00.000Z");
    await notes.put(topic.id, '{"type":"doc","content":["second"]}', later);

    const stored = await notes.get(topic.id);
    expect(stored?.contentJson).toContain("second");
    expect(stored?.updatedAt).toBe(later.toISOString());
  });
});

describe("applyDesignReview", () => {
  it("appends a review and schedules the topic forward", async () => {
    const topic = await addTopic();

    const { review, state } = await applyDesignReview(db, { topicId: topic.id, score: 5 }, NOW);

    expect(review).toMatchObject({ topicId: topic.id, score: 5, reviewedAt: NOW.toISOString() });
    expect(state.reviewCount).toBe(1);
    expect(new Date(state.dueAt).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("keeps appending rather than overwriting history", async () => {
    const topic = await addTopic();
    const later = new Date("2026-08-20T09:00:00.000Z");

    await applyDesignReview(db, { topicId: topic.id, score: 2 }, NOW);
    await applyDesignReview(db, { topicId: topic.id, score: 5 }, later);

    const history = await createDesignReviewsRepo(db).listByTopic(topic.id);
    expect(history.map((r) => r.score)).toEqual([2, 5]);
    expect((await createDesignSchedulingRepo(db).get(topic.id))?.reviewCount).toBe(2);
  });

  it("previews without writing anything", async () => {
    const topic = await addTopic();

    const preview = await previewDesignReview(db, topic.id, 5, NOW);

    expect(preview.dueAt).not.toBe("");
    expect(await createDesignSchedulingRepo(db).get(topic.id)).toBeNull();
    expect(await createDesignReviewsRepo(db).listByTopic(topic.id)).toEqual([]);
  });

  it("lists due topics separately from problems", async () => {
    const topic = await addTopic();
    await applyDesignReview(db, { topicId: topic.id, score: 0 }, NOW);

    const soon = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const due = await createDesignSchedulingRepo(db).listDueBy(soon);
    expect(due.map((s) => s.topicId)).toEqual([topic.id]);
  });
});

describe("design table rows", () => {
  it("reports a never-reviewed topic as new with no dates", async () => {
    await addTopic();
    const [row] = await listDesignTableRows(db);
    expect(row).toMatchObject({
      title: "URL shortener",
      status: "new",
      nextReview: null,
      lastReview: null,
      lastScore: null,
      reviewCount: 0,
    });
  });

  it("derives status from the review log, exactly as problems do", async () => {
    const topic = await addTopic();
    // Two consecutive failures is the leech rule, shared with problems.
    await applyDesignReview(db, { topicId: topic.id, score: 1 }, NOW);
    await applyDesignReview(db, { topicId: topic.id, score: 0 }, new Date("2026-08-02T09:00:00Z"));

    const [row] = await listDesignTableRows(db);
    expect(row?.status).toBe("leech");
    expect(row?.lastScore).toBe(0);
    expect(row?.reviewCount).toBe(2);
  });

  it("orders by title", async () => {
    await addTopic({ title: "Rate limiter" });
    await addTopic({ title: "Chat system" });
    const rows = await listDesignTableRows(db);
    expect(rows.map((r) => r.title)).toEqual(["Chat system", "Rate limiter"]);
  });

  it("lists only topics that are actually due", async () => {
    const due = await addTopic({ title: "Due topic" });
    await addTopic({ title: "Never reviewed" });
    await applyDesignReview(db, { topicId: due.id, score: 0 }, NOW);

    const soon = new Date(NOW.getTime() + 30 * 86_400_000).toISOString();
    const rows = await listDueDesignRows(db, soon);
    // A topic with no schedule at all must not appear as due.
    expect(rows.map((r) => r.title)).toEqual(["Due topic"]);
  });
});

describe("scheduling parity with problems", () => {
  /*
   * The reason design topics were allowed to reuse FSRS rather than get their own scheduler.
   * If these two ever diverge, the app has two different meanings of "due" and the whole
   * premise of one review queue falls apart.
   */
  it("schedules a design topic exactly as it schedules a problem", async () => {
    const topic = await addTopic();
    const problem = await createProblemsRepo(db).upsertBySlug(
      {
        slug: "two-sum",
        title: "Two Sum",
        url: "https://leetcode.com/problems/two-sum/",
        difficulty: "easy",
        tags: [],
      },
      NOW,
    );

    // Timestamps must advance: FSRS rejects a review dated before the previous one.
    const scores = [3, 5, 1, 4] as const;
    for (const [index, score] of scores.entries()) {
      const at = new Date(NOW.getTime() + (index + 1) * 86_400_000);
      const design = await applyDesignReview(db, { topicId: topic.id, score }, at);
      const leetcode = await applyReview(db, { problemId: problem.id, score }, at);

      expect(design.state.dueAt).toBe(leetcode.state.dueAt);
      expect(design.state.reviewCount).toBe(leetcode.state.reviewCount);
      expect(design.state.fsrsCard).toEqual(leetcode.state.fsrsCard);
    }
  });

  it("leaves the problem scheduler's public behaviour unchanged", async () => {
    // scheduleReview was refactored to delegate to nextSchedule; it must still return the id.
    const state = scheduleReview(null, "problem-1", 4, NOW);
    expect(state.problemId).toBe("problem-1");
    expect(state.reviewCount).toBe(1);
  });
});
