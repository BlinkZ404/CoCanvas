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

  it("hides the dot grid on void paper", () => {
    useCanvasStore.getState().setBackground("#0a0a0a", "human");
    render(<Canvas />);
    expect(document.getElementById("canvas-board")).toHaveClass("is-ink");
  });

  it("zooms the board from the dock", async () => {
    const user = userEvent.setup();
    render(<Canvas />);
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("110%");
    expect(document.getElementById("canvas-board")).toHaveAttribute("data-zoom", "1.1");
    await user.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");
  });

  it("marks a 1px rectangle as a rule", () => {
    const el = useCanvasStore.getState().addElement(
      { kind: "rectangle", text: "", x: 40, y: 40, width: 720, height: 1, fill: "#2a2a2e", stroke: "#2a2a2e" },
      "human"
    );
    const surfaceRef = createRef<HTMLDivElement>();
    render(<CanvasElementView element={useCanvasStore.getState().elements[0]} surfaceRef={surfaceRef} />);
    expect(document.querySelector(".el-rectangle")).toHaveClass("is-rule");
    expect(el.height).toBe(1);
  });

  it("puts an all-caps heading above the facts", () => {
    useCanvasStore.getState().addElement(
      { kind: "rectangle", text: "WHO GETS IT Plus. Pro. Business. Enterprise.", x: 40, y: 40 },
      "human"
    );
    const surfaceRef = createRef<HTMLDivElement>();
    render(<CanvasElementView element={useCanvasStore.getState().elements[0]} surfaceRef={surfaceRef} />);
    expect(document.querySelector(".shape-kicker")).toHaveTextContent("WHO GETS IT");
    expect(document.querySelector(".shape-detail")).toHaveTextContent("Plus. Pro. Business. Enterprise.");
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

  it("shift-clicks a second node into the selection", async () => {
    const user = userEvent.setup();
    const a = useCanvasStore.getState().addElement({ kind: "rectangle", text: "Cart", x: 40, y: 40 }, "human");
    const b = useCanvasStore.getState().addElement({ kind: "ellipse", text: "Pay", x: 240, y: 40 }, "human");
    const surfaceRef = createRef<HTMLDivElement>();
    render(
      <div>
        <div className="canvas-surface" ref={surfaceRef} />
        <CanvasElementView element={useCanvasStore.getState().elements[0]} surfaceRef={surfaceRef} />
        <CanvasElementView element={useCanvasStore.getState().elements[1]} surfaceRef={surfaceRef} />
      </div>
    );
    await user.click(screen.getByText("Cart"));
    await user.keyboard("{Shift>}");
    await user.click(screen.getByText("Pay"));
    await user.keyboard("{/Shift}");
    expect(useCanvasStore.getState().selectedIds).toEqual(expect.arrayContaining([a.id, b.id]));
  });
});
