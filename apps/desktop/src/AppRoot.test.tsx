import type { SqlExecutor } from "@leetbook/core";
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

const { initDatabase } = vi.hoisted(() => ({
  initDatabase: vi.fn<() => Promise<SqlExecutor>>(),
}));

vi.mock("./db/init.js", () => ({ initDatabase }));
vi.mock("./App.js", () => ({
  App: ({ db }: { db: SqlExecutor }) => <div data-testid="app">{String(Boolean(db))}</div>,
}));

import { AppRoot } from "./AppRoot.js";

describe("AppRoot", () => {
  it("opens and migrates the database once under React Strict Mode", async () => {
    initDatabase.mockResolvedValue({ execute: vi.fn(), select: vi.fn() });

    render(
      <StrictMode>
        <AppRoot />
      </StrictMode>,
    );

    expect(await screen.findByTestId("app")).toHaveTextContent("true");
    expect(initDatabase).toHaveBeenCalledTimes(1);
  });
});
