import type { SqlExecutor } from "../db/executor.js";
import { createDesignQuestionsRepo } from "../db/repositories/designQuestions.js";
import {
  type DesignNoteRow,
  type DesignReviewRow,
  type DesignSchedulingRow,
  type DesignTopicRow,
  type NoteRow,
  type ProblemRow,
  type ReviewRow,
  type SchedulingRow,
  toDesignNote,
  toDesignReview,
  toDesignSchedulingState,
  toDesignTopic,
  toNote,
  toProblem,
  toReview,
  toSchedulingState,
} from "../db/rows.js";
import type {
  DesignNote,
  DesignQuestion,
  DesignReview,
  DesignSchedulingState,
  DesignTopic,
  Note,
  Problem,
  Review,
  SchedulingState,
} from "../types.js";

export interface DatabaseExport {
  format: "leetbook";
  /**
   * 2 added the design* collections; 3 added designQuestions. An older file simply has fewer
   * keys — readers should treat a missing collection as empty, not as an error.
   */
  version: 3;
  exportedAt: string;
  problems: Problem[];
  reviews: Review[];
  scheduling: SchedulingState[];
  notes: Note[];
  designTopics: DesignTopic[];
  designReviews: DesignReview[];
  designScheduling: DesignSchedulingState[];
  designNotes: DesignNote[];
  designQuestions: DesignQuestion[];
}

/**
 * Full-database snapshot as a portable JSON string (backup / migration).
 *
 * Every table the app writes must appear here. An export that quietly omits one is worse than
 * no export at all: it looks like a backup right up until someone restores from it.
 */
export async function exportDatabaseJson(db: SqlExecutor, now: Date): Promise<string> {
  const [
    problems,
    reviews,
    scheduling,
    notes,
    designTopics,
    designReviews,
    designScheduling,
    designNotes,
  ] = await Promise.all([
    db.select<ProblemRow>("SELECT * FROM problems ORDER BY slug"),
    db.select<ReviewRow>("SELECT * FROM reviews ORDER BY reviewed_at, id"),
    db.select<SchedulingRow>("SELECT * FROM scheduling ORDER BY problem_id"),
    db.select<NoteRow>("SELECT * FROM notes ORDER BY problem_id"),
    db.select<DesignTopicRow>("SELECT * FROM design_topics ORDER BY title, id"),
    db.select<DesignReviewRow>("SELECT * FROM design_reviews ORDER BY reviewed_at, id"),
    db.select<DesignSchedulingRow>("SELECT * FROM design_scheduling ORDER BY topic_id"),
    db.select<DesignNoteRow>("SELECT * FROM design_notes ORDER BY topic_id"),
  ]);

  /*
   * Read through the repo rather than raw rows: questions are a discriminated union, and the
   * repo owns the row-to-union mapping. Duplicating it here would be a second place to fix.
   */
  const topicIds = designTopics.map((row) => row.id);
  const questionsRepo = createDesignQuestionsRepo(db);
  const designQuestions = (
    await Promise.all(topicIds.map((id) => questionsRepo.listByTopic(id)))
  ).flat();

  const payload: DatabaseExport = {
    format: "leetbook",
    version: 3,
    exportedAt: now.toISOString(),
    problems: problems.map(toProblem),
    reviews: reviews.map(toReview),
    scheduling: scheduling.map(toSchedulingState),
    notes: notes.map(toNote),
    designTopics: designTopics.map(toDesignTopic),
    designReviews: designReviews.map(toDesignReview),
    designScheduling: designScheduling.map(toDesignSchedulingState),
    designNotes: designNotes.map(toDesignNote),
    designQuestions,
  };
  return JSON.stringify(payload, null, 2);
}
