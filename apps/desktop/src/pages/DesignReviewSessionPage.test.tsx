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
