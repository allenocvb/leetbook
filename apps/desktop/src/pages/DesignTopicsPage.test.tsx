import { applyDesignReview, createDesignTopicsRepo, type SqlExecutor } from "@leetbook/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DbProvider } from "../db/DbContext.js";
import { makeDb } from "../test-utils.js";
import { DesignTopicsPage } from "./DesignTopicsPage.js";

const AT = new Date("2026-08-01T09:00:00.000Z");

async function seedTopics(db: SqlExecutor) {
  const repo = createDesignTopicsRepo(db);
  const shortener = await repo.add(
    { title: "URL shortener", prompt: "Design a link shortener.", tags: ["Caching", "Sharding"] },
    AT,
  );
  await repo.add(
    { title: "Chat system", prompt: "Design a realtime chat.", tags: ["WebSockets"] },
    AT,
  );
  return shortener;
}

async function renderPage({ onOpenTopic = vi.fn() } = {}) {
  const db = await makeDb();
  const shortener = await seedTopics(db);
  const view = render(
    <DbProvider db={db}>
      <DesignTopicsPage onOpenTopic={onOpenTopic} />
    </DbProvider>,
  );
  await waitFor(() => expect(screen.getByText("URL shortener")).toBeInTheDocument());
  return { db, shortener, onOpenTopic, ...view };
}

describe("DesignTopicsPage", () => {
  it("lists topics with their derived status", async () => {
    await renderPage();

    expect(screen.getByText("Chat system")).toBeInTheDocument();
    expect(screen.getAllByText("New")).toHaveLength(2);
    expect(screen.getByText("2 topics")).toBeInTheDocument();
  });

  it("shows tags as chips and an em dash when there are none", async () => {
    const db = await makeDb();
    await createDesignTopicsRepo(db).add({ title: "Untagged", prompt: "", tags: [] }, AT);
    render(
      <DbProvider db={db}>
        <DesignTopicsPage onOpenTopic={vi.fn()} />
      </DbProvider>,
    );

    await waitFor(() => expect(screen.getByText("Untagged")).toBeInTheDocument());
    expect(
      screen.getByText("—", { selector: ".problem-row__category--empty" }),
    ).toBeInTheDocument();
  });

  it("has no difficulty column, because design topics have no difficulty", async () => {
    await renderPage();
    expect(screen.queryByRole("button", { name: /Difficulty/ })).not.toBeInTheDocument();
  });

  it("opens a topic when its title is clicked", async () => {
    const { onOpenTopic, shortener } = await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Open notes for URL shortener" }));

    expect(onOpenTopic).toHaveBeenCalledWith(shortener.id);
  });

  it("searches titles, prompts and tags", async () => {
    await renderPage();
    const search = screen.getByRole("searchbox", { name: "Search topics" });

    // "realtime" appears only in the chat topic's prompt, never in a title.
    await userEvent.type(search, "realtime");

    await waitFor(() => expect(screen.queryByText("URL shortener")).not.toBeInTheDocument());
    expect(screen.getByText("Chat system")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 topics")).toBeInTheDocument();
  });

  it("sorts by title and reverses on a second click", async () => {
    await renderPage();
    const rowTitles = () =>
      screen
        .getAllByRole("button", { name: /^Open notes for/ })
        .map((button) => button.textContent);

    expect(rowTitles()).toEqual(["Chat system", "URL shortener"]);
    await userEvent.click(screen.getByRole("button", { name: /^Topic,/ }));
    expect(rowTitles()).toEqual(["URL shortener", "Chat system"]);
  });

  it("adds a topic and shows it without a reload", async () => {
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "+ New topic" }));
    const dialog = screen.getByRole("dialog", { name: "New design topic" });
    await userEvent.type(within(dialog).getByLabelText("Title"), "Rate limiter");
    await userEvent.type(within(dialog).getByLabelText("Tags"), "Throttling, throttling");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add topic" }));

    await waitFor(() => expect(screen.getByText("Rate limiter")).toBeInTheDocument());
    // Case-duplicate tags are folded together on write.
    expect(screen.getAllByText("Throttling")).toHaveLength(1);
  });

  it("refuses to add a topic with no title", async () => {
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "+ New topic" }));
    const dialog = screen.getByRole("dialog", { name: "New design topic" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add topic" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(/title/i);
    expect(screen.getByText("2 topics")).toBeInTheDocument();
  });

  it("deletes a topic through a confirmation dialog", async () => {
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Delete Chat system" }));
    const dialog = screen.getByRole("dialog", { name: "Delete topic" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete Chat system" }));

    await waitFor(() => expect(screen.queryByText("Chat system")).not.toBeInTheDocument());
    expect(screen.getByText("URL shortener")).toBeInTheDocument();
  });

  it("shows review history once a topic has been reviewed", async () => {
    const db = await makeDb();
    const topic = await createDesignTopicsRepo(db).add(
      { title: "URL shortener", prompt: "", tags: [] },
      AT,
    );
    await applyDesignReview(db, { topicId: topic.id, score: 5 }, AT);

    render(
      <DbProvider db={db}>
        <DesignTopicsPage onOpenTopic={vi.fn()} />
      </DbProvider>,
    );

    await waitFor(() => expect(screen.getByText("URL shortener")).toBeInTheDocument());
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("invites a first topic when there are none", async () => {
    const db = await makeDb();
    render(
      <DbProvider db={db}>
        <DesignTopicsPage onOpenTopic={vi.fn()} />
      </DbProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/add your first design topic/i)).toBeInTheDocument(),
    );
  });
});
