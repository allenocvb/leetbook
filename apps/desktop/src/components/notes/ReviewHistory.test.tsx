import type { Review } from "@leetbook/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ReviewHistory } from "./ReviewHistory.js";

const REVIEWS: Review[] = [
  makeReview("first", 2, "2026-07-10T00:00:00.000Z"),
  makeReview("latest", 5, "2026-07-24T00:00:00.000Z"),
];

it("shows every review newest-first and only corrects the latest", async () => {
  const onCorrectLatest = vi.fn();
  render(<ReviewHistory reviews={REVIEWS} onCorrectLatest={onCorrectLatest} />);

  const items = screen.getAllByRole("listitem");
  const [latest, earlier] = items;
  if (!latest || !earlier) throw new Error("expected two review rows");
  expect(within(latest).getByText("5")).toBeInTheDocument();
  expect(within(latest).getByText("Perfect")).toBeInTheDocument();
  expect(within(earlier).getByText("2")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Correct latest score" })).toHaveLength(1);

  await userEvent.click(screen.getByRole("button", { name: "Correct latest score" }));
  expect(onCorrectLatest).toHaveBeenCalledOnce();
});

function makeReview(id: string, score: Review["score"], reviewedAt: string): Review {
  return {
    id,
    problemId: "problem",
    score,
    reviewedAt,
    runtimeMs: null,
    memoryMb: null,
    language: null,
    codeSnapshot: null,
  };
}
