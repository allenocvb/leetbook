import { createDesignQuestionsRepo, type DesignQuestion } from "@leetbook/core";
import { useCallback, useEffect, useState } from "react";
import { useDb } from "../../db/DbContext.js";
import { Button } from "../ui/Button.js";
import { GenerateQuestionsDialog } from "./GenerateQuestionsDialog.js";
import { QuestionDialog } from "./QuestionDialog.js";
import "./QuestionDialog.css";

/**
 * Quiz questions for one topic, authored by hand.
 *
 * Deliberately built before any AI: a review loop with questions you wrote is already a
 * complete feature, and if the loop is wrong no model fixes it. Phase 16 fills this same list
 * from a generated draft that the user edits before saving.
 */
export interface QuestionListProps {
  topicId: string;
  /** Passed through to generation so questions are grounded in this topic. */
  title?: string;
  prompt?: string;
  notes?: string;
}

export function QuestionList({ topicId, title = "", prompt = "", notes = "" }: QuestionListProps) {
  const db = useDb();
  const [questions, setQuestions] = useState<DesignQuestion[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DesignQuestion | null>(null);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    setQuestions(await createDesignQuestionsRepo(db).listByTopic(topicId));
  }, [db, topicId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (id: string) => {
    await createDesignQuestionsRepo(db).remove(id);
    await refresh();
  };

  return (
    <section className="question-list" aria-label="Quiz questions">
      <header className="question-list__header">
        <h2 className="question-list__title">
          Quiz questions{questions.length > 0 ? ` (${questions.length})` : ""}
        </h2>
        <span className="question-list__actions">
          <Button variant="ghost" onClick={() => setGenerating(true)}>
            Generate with AI
          </Button>
          <Button variant="ghost" onClick={() => setAdding(true)}>
            + Add question
          </Button>
        </span>
      </header>

      {questions.length === 0 ? (
        <p className="question-list__empty">
          No questions yet. Write a few and they'll appear in review sessions for this topic.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {questions.map((question) => (
            <li className="question-list__item" key={question.id}>
              <span className="question-list__kind">
                {question.kind === "choice" ? "Choice" : "Written"}
              </span>
              <span className="question-list__prompt">{question.prompt}</span>
              <span className="question-list__actions">
                <Button
                  variant="ghost"
                  aria-label={`Edit question: ${question.prompt}`}
                  onClick={() => setEditing(question)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete question: ${question.prompt}`}
                  onClick={() => void remove(question.id)}
                >
                  ×
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <QuestionDialog
          topicId={topicId}
          onClose={() => setAdding(false)}
          onSaved={() => void refresh()}
        />
      )}
      {generating && (
        <GenerateQuestionsDialog
          topicId={topicId}
          title={title}
          prompt={prompt}
          notes={notes}
          onClose={() => setGenerating(false)}
          onSaved={() => void refresh()}
        />
      )}
      {editing && (
        <QuestionDialog
          key={editing.id}
          topicId={topicId}
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      )}
    </section>
  );
}
