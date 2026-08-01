import type {
  DesignNote,
  DesignReview,
  DesignSchedulingState,
  DesignTopic,
  Note,
  Problem,
  Review,
  SchedulingState,
} from "../types.js";

/** Raw snake_case rows as they come back from SQLite. */

export interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  url: string;
  difficulty: string;
  tags: string;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  problem_id: string;
  score: number;
  reviewed_at: string;
  runtime_ms: number | null;
  memory_mb: number | null;
  language: string | null;
  code_snapshot: string | null;
}

export interface SchedulingRow {
  problem_id: string;
  due_at: string;
  review_count: number;
  last_reviewed_at: string | null;
  fsrs_card: string;
}

export interface NoteRow {
  problem_id: string;
  content_json: string;
  updated_at: string;
}

export function toProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    url: row.url,
    difficulty: row.difficulty as Problem["difficulty"],
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
  };
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    problemId: row.problem_id,
    score: row.score as Review["score"],
    reviewedAt: row.reviewed_at,
    runtimeMs: row.runtime_ms,
    memoryMb: row.memory_mb,
    language: row.language,
    codeSnapshot: row.code_snapshot,
  };
}

export function toSchedulingState(row: SchedulingRow): SchedulingState {
  return {
    problemId: row.problem_id,
    dueAt: row.due_at,
    reviewCount: row.review_count,
    lastReviewedAt: row.last_reviewed_at,
    fsrsCard: JSON.parse(row.fsrs_card) as SchedulingState["fsrsCard"],
  };
}

export function toNote(row: NoteRow): Note {
  return {
    problemId: row.problem_id,
    contentJson: row.content_json,
    updatedAt: row.updated_at,
  };
}

export interface DesignTopicRow {
  id: string;
  title: string;
  prompt: string;
  tags: string;
  created_at: string;
}

export interface DesignReviewRow {
  id: string;
  topic_id: string;
  score: number;
  reviewed_at: string;
}

export interface DesignSchedulingRow {
  topic_id: string;
  due_at: string;
  review_count: number;
  last_reviewed_at: string | null;
  fsrs_card: string;
}

export interface DesignNoteRow {
  topic_id: string;
  content_json: string;
  scene_json: string | null;
  updated_at: string;
}

export function toDesignTopic(row: DesignTopicRow): DesignTopic {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
  };
}

export function toDesignReview(row: DesignReviewRow): DesignReview {
  return {
    id: row.id,
    topicId: row.topic_id,
    score: row.score as DesignReview["score"],
    reviewedAt: row.reviewed_at,
  };
}

export function toDesignSchedulingState(row: DesignSchedulingRow): DesignSchedulingState {
  return {
    topicId: row.topic_id,
    dueAt: row.due_at,
    reviewCount: row.review_count,
    lastReviewedAt: row.last_reviewed_at,
    fsrsCard: JSON.parse(row.fsrs_card) as DesignSchedulingState["fsrsCard"],
  };
}

export function toDesignNote(row: DesignNoteRow): DesignNote {
  return {
    topicId: row.topic_id,
    contentJson: row.content_json,
    sceneJson: row.scene_json,
    updatedAt: row.updated_at,
  };
}
