import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import { Toolbar } from "./Toolbar";

describe("Toolbar", () => {
  it("adds a rectangle on click", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Add Rectangle" }));
    expect(useCanvasStore.getState().elements).toHaveLength(1);
    expect(useCanvasStore.getState().elements[0].kind).toBe("rectangle");
  });

  it("disables connect until two nodes exist", () => {
    render(<Toolbar />);
    expect(screen.getByRole("button", { name: "Connect two nodes" })).toBeDisabled();
    useCanvasStore.getState().addElement({ kind: "rectangle" }, "human");
    useCanvasStore.getState().addElement({ kind: "ellipse" }, "human");
    render(<Toolbar />);
    const connectButtons = screen.getAllByRole("button", { name: "Connect two nodes" });
    expect(connectButtons[connectButtons.length - 1]).toBeEnabled();
  });

  it("clears the board after confirm", async () => {
    const user = userEvent.setup();
    useCanvasStore.getState().addElement({ kind: "text" }, "human");
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Clear canvas" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(useCanvasStore.getState().elements).toHaveLength(0);
  });
});
