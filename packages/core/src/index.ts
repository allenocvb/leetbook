export {
  CATEGORIES,
  type Category,
  isKnownCategory,
  normalizeCategories,
  normalizeCategory,
  normalizeStoredCategories,
} from "./categories.js";
export type { SqlExecutor } from "./db/executor.js";
export { migrate } from "./db/migrate.js";
export { MIGRATIONS, type Migration } from "./db/migrations.js";
export { createDesignNotesRepo, type DesignNotesRepo } from "./db/repositories/designNotes.js";
export {
  createDesignQuestionsRepo,
  type DesignQuestionInput,
  type DesignQuestionsRepo,
  gradeChoice,
} from "./db/repositories/designQuestions.js";
export {
  createDesignReviewsRepo,
  createDesignSchedulingRepo,
  type DesignReviewInput,
  type DesignReviewsRepo,
  type DesignSchedulingRepo,
} from "./db/repositories/designReviews.js";
export {
  createDesignTopicsRepo,
  type DesignTopicInput,
  type DesignTopicsRepo,
  normalizeTopicTags,
} from "./db/repositories/designTopics.js";
export { createFilesRepo, type LibraryFile } from "./db/repositories/files.js";
export { createNotesRepo, type NotesRepo } from "./db/repositories/notes.js";
export {
  createProblemsRepo,
  type ProblemInput,
  type ProblemsRepo,
} from "./db/repositories/problems.js";
export {
  createReviewsRepo,
  type ReviewInput,
  type ReviewsRepo,
} from "./db/repositories/reviews.js";
export { createSchedulingRepo, type SchedulingRepo } from "./db/repositories/scheduling.js";
export {
  type ApplyDesignReviewResult,
  applyDesignReview,
  previewDesignReview,
} from "./designReview.js";
export { type DatabaseExport, exportDatabaseJson } from "./export/json.js";
export { exportNotesMarkdown, type NoteExport, tiptapToMarkdown } from "./export/markdown.js";
export {
  importNotionCsv,
  type NotionImportIssue,
  type NotionImportResult,
  slugFromUrl,
} from "./import/notion.js";
export { recomputeSchedules } from "./recomputeSchedules.js";
export {
  type ApplyReviewInput,
  type ApplyReviewResult,
  applyReview,
  type CorrectLatestReviewResult,
  correctLatestReview,
  previewReview,
  type ReviseLatestReviewInput,
  reviseLatestReview,
} from "./review.js";
export {
  intervalDays,
  MAX_INTERVAL_DAYS,
  nextSchedule,
  type ScheduleOutcome,
  scheduleReview,
} from "./schedule.js";
export type { PerformanceScore } from "./scoring.js";
export {
  type ChoiceQuestion,
  type DesignNote,
  type DesignQuestion,
  type DesignReview,
  type DesignSchedulingState,
  type DesignTopic,
  type Difficulty,
  type FsrsCardSnapshot,
  type IsoDateTime,
  isDifficulty,
  isPerformanceScore,
  type Note,
  type Problem,
  type Review,
  type SchedulingState,
  type TextQuestion,
} from "./types.js";
export {
  type DesignTableRow,
  listDesignTableRows,
  listDueDesignRows,
} from "./views/designTable.js";
export { deriveStatus, type ProblemStatus, type StatusInput } from "./views/status.js";
export { listDueRows, listTableRows, type TableRow } from "./views/table.js";
