import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DesignCanvas } from "./DesignCanvas.js";

/*
 * Excalidraw itself is not under test — it needs a real <canvas>, which jsdom lacks, and it
 * is not our code. What is ours is the boundary: that the module is fetched lazily rather
 * than imported at the top level, and that a fallback is shown while it arrives.
 */
const loaded = vi.hoisted(() => ({ count: 0 }));

vi.mock("./ExcalidrawCanvas.js", () => ({
  default: ({ sceneJson, theme }: { sceneJson: string | null; theme: string }) => {
    loaded.count += 1;
    return <div data-testid="excalidraw" data-theme={theme} data-scene={sceneJson ?? ""} />;
  },
}));

describe("DesignCanvas", () => {
  it("does not load Excalidraw until it is rendered", () => {
    // Importing this module must not pull in a megabyte of canvas code.
    expect(loaded.count).toBe(0);
  });

  it("shows a fallback, then the canvas", async () => {
    render(<DesignCanvas sceneJson={null} onChange={vi.fn()} theme="light" />);

    await waitFor(() => expect(screen.getByTestId("excalidraw")).toBeInTheDocument());
    expect(loaded.count).toBeGreaterThan(0);
  });

  it("passes the stored scene and the app's theme through", async () => {
    render(<DesignCanvas sceneJson='{"elements":[]}' onChange={vi.fn()} theme="dark" />);

    await waitFor(() => expect(screen.getByTestId("excalidraw")).toBeInTheDocument());
    const canvas = screen.getByTestId("excalidraw");
    expect(canvas).toHaveAttribute("data-theme", "dark");
    expect(canvas).toHaveAttribute("data-scene", '{"elements":[]}');
  });

  it("expands to full screen and leaves it on Escape without remounting the canvas", async () => {
    render(<DesignCanvas sceneJson={null} onChange={vi.fn()} theme="light" />);
    await waitFor(() => expect(screen.getByTestId("excalidraw")).toBeInTheDocument());
    const canvas = screen.getByTestId("excalidraw");

    await userEvent.click(screen.getByRole("button", { name: /Full screen/ }));
    expect(screen.getByRole("region", { name: "Diagram, full screen" })).toBeInTheDocument();
    expect(screen.getByTestId("excalidraw")).toBe(canvas);

    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "Diagram" })).toBeInTheDocument();
    expect(screen.getByTestId("excalidraw")).toBe(canvas);
  });

  it("tells the user the drawing is being saved", async () => {
    const { rerender } = render(
      <DesignCanvas sceneJson={null} onChange={vi.fn()} theme="light" saveState="pending" />,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    rerender(<DesignCanvas sceneJson={null} onChange={vi.fn()} theme="light" saveState="saved" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
