import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { useCanvasStore } from "./store/canvasStore";

describe("App", () => {
  it("renders the shell and skip link", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Skip to canvas" })).toHaveAttribute("href", "#canvas-board");
    expect(screen.getByRole("heading", { name: "CoCanvas" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Canvas" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Insert shapes" })).toBeInTheDocument();
  });

  it("adds a node from the rail and records it in activity", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add Ellipse" }));
    expect(useCanvasStore.getState().elements[0]?.kind).toBe("ellipse");
    expect(screen.getByText(/added an ellipse/i)).toBeInTheDocument();
  });

  it("does not undo the board while the brief is focused", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add Ellipse" }));
    await user.click(screen.getByRole("textbox", { name: "Brief" }));
    await user.keyboard("{Control>}z{/Control}");
    expect(useCanvasStore.getState().elements).toHaveLength(1);
  });

  it("selects every node with Control+A", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add Rectangle" }));
    await user.click(screen.getByRole("button", { name: "Add Ellipse" }));
    await user.keyboard("{Control>}a{/Control}");
    expect(useCanvasStore.getState().selectedIds).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
  });

  it("undoes with the keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add Text" }));
    expect(useCanvasStore.getState().elements).toHaveLength(1);
    await user.keyboard("{Control>}z{/Control}");
    expect(useCanvasStore.getState().elements).toHaveLength(0);
  });
});
