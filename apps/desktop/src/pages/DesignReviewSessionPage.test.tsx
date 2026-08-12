import {
  applyDesignReview,
  createDesignQuestionsRepo,
  createDesignReviewsRepo,
  createDesignSchedulingRepo,
  createDesignTopicsRepo,
  type SqlExecutor,
} from "@leetbook/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb } from "../test-utils.js";
import { DesignReviewSessionPage } from "./DesignReviewSessionPage.js";

const LONG_AGO = new Date("2020-01-01T09:00:00.000Z");

let db: SqlExecutor;

beforeEach(async () => {
  db = await makeDb();
});

/** A topic scored 0 in 2020 is comfortably overdue today. */
async function dueTopic(title = "URL shortener", prompt = "Design a link shortener.") {
  const topic = await createDesignTopicsRepo(db).add(
    { title, prompt, tags: ["Caching"] },
    LONG_AGO,
  );
  await applyDesignReview(db, { topicId: topic.id, score: 0 }, LONG_AGO);
  return topic;
}

const renderSession = ({ onExit = vi.fn(), onShowNotes = vi.fn() } = {}) => {
  render(
    <DbProvider db={db}>
      <DesignReviewSessionPage onExit={onExit} onShowNotes={onShowNotes} />
    </DbProvider>,
  );
  return { onExit, onShowNotes };
};

describe("DesignReviewSessionPage", () => {
  it("says nothing is due when no topic is overdue", async () => {
    await createDesignTopicsRepo(db).add({ title: "Fresh", prompt: "", tags: [] }, LONG_AGO);
    renderSession();
    await waitFor(() => expect(screen.getByText("Nothing due")).toBeInTheDocument());
  });

  it("rates a topic with no questions and schedules it forward", async () => {
    const topic = await dueTopic();
    renderSession();

    await waitFor(() => expect(screen.getByText("URL shortener")).toBeInTheDocument());
    // With no questions there is nothing to reveal, so rating is available immediately.
    await userEvent.click(screen.getByRole("button", { name: /^5\b/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByText("Session complete")).toBeInTheDocument());
    const reviews = await createDesignReviewsRepo(db).listByTopic(topic.id);
    expect(reviews.map((r) => r.score)).toEqual([0, 5]);
    const state = await createDesignSchedulingRepo(db).get(topic.id);
    expect(new Date(state?.dueAt ?? 0).getTime()).toBeGreaterThan(Date.now());
  });

  it("shows the prompt and the topic's questions", async () => {
    const topic = await dueTopic();
    await createDesignQuestionsRepo(db).add(
      topic.id,
      { kind: "choice", prompt: "Which store?", choices: ["SQL", "KV"], answerIndex: 1 },
      LONG_AGO,
    );
    renderSession();

    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());
    expect(screen.getByText(/Design a link shortener/)).toBeInTheDocument();
  });

  /*
   * Rating before seeing the answers is guesswork, and a guessed score goes straight into the
   * schedule. So the picker only appears once answers are revealed.
   */
  it("withholds the rating until answers are revealed", async () => {
    const topic = await dueTopic();
    await createDesignQuestionsRepo(db).add(
      topic.id,
      { kind: "text", prompt: "How would you shard?", modelAnswer: "By key hash." },
      LONG_AGO,
    );
    renderSession();

    await waitFor(() => expect(screen.getByText("How would you shard?")).toBeInTheDocument());
    expect(screen.queryByText("How well did you recall it?")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));

    expect(screen.getByText("How well did you recall it?")).toBeInTheDocument();
    expect(screen.getByText("By key hash.")).toBeInTheDocument();
  });

  it("grades multiple choice locally and reports a tally", async () => {
    const topic = await dueTopic();
    const repo = createDesignQuestionsRepo(db);
    await repo.add(
      topic.id,
      { kind: "choice", prompt: "Which store?", choices: ["SQL", "KV"], answerIndex: 1 },
      LONG_AGO,
    );
    await repo.add(
      topic.id,
      { kind: "choice", prompt: "Which id?", choices: ["UUID", "Counter"], answerIndex: 1 },
      LONG_AGO,
    );
    renderSession();

    await waitFor(() => expect(screen.getByText("Which store?")).toBeInTheDocument());
    // Answer the first correctly and the second wrongly.
    await userEvent.click(screen.getAllByRole("radio")[1] as HTMLElement);
    await userEvent.click(screen.getAllByRole("radio")[2] as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));

    expect(screen.getByText(/1 of 2 multiple choice correct/)).toBeInTheDocument();
    // The tally is information, never the rating — that stays the user's call.
    expect(screen.getByText(/still your own call/)).toBeInTheDocument();
  });

  it("moves through a multi-topic queue and summarises at the end", async () => {
    await dueTopic("URL shortener");
    await dueTopic("Chat system");
    renderSession();

    await waitFor(() => expect(screen.getByText("1 of 2")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^4\b/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByText("2 of 2")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^1\b/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByText("Session complete")).toBeInTheDocument());
    expect(screen.getByText(/2 reviewed · 1 recalled · 1 to re-study/)).toBeInTheDocument();
  });

  it("resets answers between topics rather than carrying them over", async () => {
    const first = await dueTopic("Aaa first");
    await dueTopic("Bbb second");
    await createDesignQuestionsRepo(db).add(
      first.id,
      { kind: "text", prompt: "First question", modelAnswer: "" },
      LONG_AGO,
    );
    renderSession();

    await waitFor(() => expect(screen.getByText("First question")).toBeInTheDocument());
    await userEvent.type(screen.getByRole("textbox"), "my answer");
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    await userEvent.click(screen.getByRole("button", { name: /^3\b/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    // The second topic has no questions, so nothing from the first may still be on screen.
    await waitFor(() => expect(screen.getByText("Bbb second")).toBeInTheDocument());
    expect(screen.queryByText("First question")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("my answer")).not.toBeInTheDocument();
  });
});

describe("DesignReviewSessionPage AI grading", () => {
  const grader = (score = 4, reasoning = "Missed the caching layer.") => ({
    generateQuestions: vi.fn(),
    gradeAnswer: vi.fn(async () => ({ suggestedScore: score as 0 | 1 | 2 | 3 | 4 | 5, reasoning })),
  });

  async function sessionWithWrittenQuestion(loadProvider: () => Promise<unknown>) {
    const topic = await dueTopic();
    await createDesignQuestionsRepo(db).add(
      topic.id,
      { kind: "text", prompt: "How would you shard?", modelAnswer: "By key hash." },
      LONG_AGO,
    );
    render(
      <DbProvider db={db}>
        <DesignReviewSessionPage
          onExit={vi.fn()}
          // biome-ignore lint/suspicious/noExplicitAny: narrowing the stub adds nothing here
          loadProvider={loadProvider as any}
        />
      </DbProvider>,
    );
    await waitFor(() => expect(screen.getByText("How would you shard?")).toBeInTheDocument());
    return topic;
  }

  it("does not offer grading when no key is set", async () => {
    await sessionWithWrittenQuestion(async () => null);
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    expect(screen.queryByRole("button", { name: "Grade my answers" })).not.toBeInTheDocument();
  });

  it("does not offer grading for an unanswered question", async () => {
    await sessionWithWrittenQuestion(async () => grader());
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    // Nothing was typed, so there is nothing to grade and no reason to spend a request.
    expect(screen.queryByRole("button", { name: "Grade my answers" })).not.toBeInTheDocument();
  });

  /*
   * The whole point of Phase 16.4. The model may suggest, but the rating stays the user's:
   * a lenient grader that wrote straight into FSRS would push a topic weeks out and the
   * schedule would rot without anyone noticing.
   */
  it("suggests a score without selecting it", async () => {
    await sessionWithWrittenQuestion(async () => grader(4));

    await userEvent.type(screen.getByRole("textbox"), "Hash the key and mod by shard count.");
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    await userEvent.click(screen.getByRole("button", { name: "Grade my answers" }));

    await waitFor(() => expect(screen.getByText(/Missed the caching layer/)).toBeInTheDocument());
    // Save stays disabled: nothing has been chosen on the user's behalf.
    expect(screen.getByRole("button", { name: "Save and continue" })).toBeDisabled();
  });

  it("applies the suggestion only when the user asks for it", async () => {
    const topic = await sessionWithWrittenQuestion(async () => grader(4));

    await userEvent.type(screen.getByRole("textbox"), "Hash the key.");
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    await userEvent.click(screen.getByRole("button", { name: "Grade my answers" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Use 4" })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Use 4" }));
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(async () => {
      const reviews = await createDesignReviewsRepo(db).listByTopic(topic.id);
      expect(reviews.map((r) => r.score)).toEqual([0, 4]);
    });
  });

  it("lets the user overrule the suggestion", async () => {
    const topic = await sessionWithWrittenQuestion(async () => grader(5));

    await userEvent.type(screen.getByRole("textbox"), "Vague hand-wave.");
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    await userEvent.click(screen.getByRole("button", { name: "Grade my answers" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Use 5" })).toBeInTheDocument());

    // Disagreeing with a generous grader must be as easy as accepting it.
    await userEvent.click(screen.getByRole("button", { name: /^2\b/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(async () => {
      const reviews = await createDesignReviewsRepo(db).listByTopic(topic.id);
      expect(reviews.map((r) => r.score)).toEqual([0, 2]);
    });
  });

  it("says grading failed and still lets the review finish", async () => {
    await sessionWithWrittenQuestion(async () => ({
      generateQuestions: vi.fn(),
      gradeAnswer: vi.fn(async () => {
        throw new Error("Rate limited");
      }),
    }));

    await userEvent.type(screen.getByRole("textbox"), "An answer.");
    await userEvent.click(screen.getByRole("button", { name: "Show answers" }));
    await userEvent.click(screen.getByRole("button", { name: "Grade my answers" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Rate it yourself/);
    // The optional part failing must not block the part that matters.
    expect(screen.getByRole("button", { name: /^3\b/ })).toBeEnabled();
  });
});
