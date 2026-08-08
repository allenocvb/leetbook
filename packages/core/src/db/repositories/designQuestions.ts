import type { DesignQuestion } from "../../types.js";
import type { SqlExecutor } from "../executor.js";

export type DesignQuestionInput =
  | { kind: "choice"; prompt: string; choices: string[]; answerIndex: number; modelAnswer?: string }
  | { kind: "text"; prompt: string; modelAnswer?: string };

export interface DesignQuestionsRepo {
  add(topicId: string, input: DesignQuestionInput, now: Date): Promise<DesignQuestion>;
  update(id: string, input: DesignQuestionInput): Promise<DesignQuestion>;
  listByTopic(topicId: string): Promise<DesignQuestion[]>;
  getById(id: string): Promise<DesignQuestion | null>;
  remove(id: string): Promise<void>;
}

interface QuestionRow {
  id: string;
  topic_id: string;
  kind: string;
  prompt: string;
  choices: string | null;
  answer_index: number | null;
  model_answer: string;
  position: number;
  created_at: string;
}

function toQuestion(row: QuestionRow): DesignQuestion {
  const base = {
    id: row.id,
    topicId: row.topic_id,
    prompt: row.prompt,
    modelAnswer: row.model_answer,
    position: row.position,
    createdAt: row.created_at,
  };
  if (row.kind === "choice") {
    return {
      ...base,
      kind: "choice",
      choices: JSON.parse(row.choices ?? "[]") as string[],
      answerIndex: row.answer_index ?? 0,
    };
  }
  return { ...base, kind: "text" };
}

/**
 * Rejects a question that cannot be answered.
 *
 * Validating here rather than only in the UI: Phase 16 will write to this repo from a model's
 * output, and a generated multiple-choice question with one option or an out-of-range answer
 * would otherwise be stored and only fail later, mid-review.
 */
function validate(input: DesignQuestionInput): void {
  if (input.prompt.trim() === "") throw new Error("A question needs a prompt.");
  if (input.kind !== "choice") return;

  const filled = input.choices.filter((choice) => choice.trim() !== "");
  if (filled.length < 2) throw new Error("A multiple-choice question needs at least two options.");
  if (input.answerIndex < 0 || input.answerIndex >= input.choices.length) {
    throw new Error("The correct answer must be one of the options.");
  }
}

function columns(input: DesignQuestionInput): [string, string | null, number | null, string] {
  return [
    input.kind,
    input.kind === "choice" ? JSON.stringify(input.choices) : null,
    input.kind === "choice" ? input.answerIndex : null,
    input.modelAnswer ?? "",
  ];
}

export function createDesignQuestionsRepo(db: SqlExecutor): DesignQuestionsRepo {
  const read = async (id: string): Promise<DesignQuestion> => {
    const rows = await db.select<QuestionRow>("SELECT * FROM design_questions WHERE id = ?", [id]);
    const row = rows[0];
    if (!row) throw new Error(`design question "${id}" was not found`);
    return toQuestion(row);
  };

  return {
    async add(topicId, input, now) {
      validate(input);
      const id = crypto.randomUUID();
      const [next] = await db.select<{ next: number }>(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM design_questions WHERE topic_id = ?",
        [topicId],
      );
      const [kind, choices, answerIndex, modelAnswer] = columns(input);

      await db.execute(
        `INSERT INTO design_questions
           (id, topic_id, kind, prompt, choices, answer_index, model_answer, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          topicId,
          kind,
          input.prompt.trim(),
          choices,
          answerIndex,
          modelAnswer,
          next?.next ?? 0,
          now.toISOString(),
        ],
      );
      return read(id);
    },

    async update(id, input) {
      validate(input);
      const [kind, choices, answerIndex, modelAnswer] = columns(input);
      await db.execute(
        `UPDATE design_questions
         SET kind = ?, prompt = ?, choices = ?, answer_index = ?, model_answer = ?
         WHERE id = ?`,
        [kind, input.prompt.trim(), choices, answerIndex, modelAnswer, id],
      );
      return read(id);
    },

    async listByTopic(topicId) {
      const rows = await db.select<QuestionRow>(
        "SELECT * FROM design_questions WHERE topic_id = ? ORDER BY position, created_at",
        [topicId],
      );
      return rows.map(toQuestion);
    },

    async getById(id) {
      const rows = await db.select<QuestionRow>("SELECT * FROM design_questions WHERE id = ?", [
        id,
      ]);
      return rows[0] ? toQuestion(rows[0]) : null;
    },

    async remove(id) {
      await db.execute("DELETE FROM design_questions WHERE id = ?", [id]);
    },
  };
}

/**
 * Grades a multiple-choice answer. No model, no network — the answer is stored with the
 * question, so this works offline forever, which is the whole reason choice questions exist
 * alongside free text.
 */
export function gradeChoice(question: DesignQuestion, chosenIndex: number | null): boolean {
  return question.kind === "choice" && chosenIndex === question.answerIndex;
}
