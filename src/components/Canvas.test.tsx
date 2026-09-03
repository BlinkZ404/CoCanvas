import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import { Canvas } from "./Canvas";
import { CanvasElementView } from "./CanvasElement";

describe("Canvas", () => {
  it("shows the empty hint and a world that can host nodes", () => {
    render(<Canvas />);
    expect(screen.getByText(/Drag a shape from the toolbar/i)).toBeInTheDocument();
    expect(document.querySelector(".canvas-world")).toBeTruthy();
  });

  it("selects a node and shows resize handles", async () => {
    const user = userEvent.setup();
    const el = useCanvasStore.getState().addElement({ kind: "rectangle", text: "Cart review", x: 40, y: 40 }, "human");
    const surfaceRef = createRef<HTMLDivElement>();
    render(
      <div>
        <div className="canvas-surface" ref={surfaceRef} />
        <CanvasElementView element={useCanvasStore.getState().elements[0]} surfaceRef={surfaceRef} />
      </div>
    );
    await user.click(screen.getByText("Cart review"));
    expect(useCanvasStore.getState().selectedId).toBe(el.id);
    expect(screen.getByRole("button", { name: "Resize se" })).toBeInTheDocument();
  });
});
