import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MIN_NODE_W } from "../geometry/board";
import { useCanvasStore } from "../store/canvasStore";
import { Inspector } from "./Inspector";

describe("Inspector", () => {
  it("shows the empty properties state", () => {
    render(<Inspector />);
    expect(screen.getByRole("heading", { name: "Properties" })).toBeInTheDocument();
    expect(screen.getByText("Select a shape to edit.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Properties" }).closest(".inspector")).toHaveClass("is-empty");
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });

  it("edits label and clamps width to the minimum", async () => {
    const user = userEvent.setup();
    const el = useCanvasStore.getState().addElement({ kind: "rectangle", text: "Pay" }, "human");
    useCanvasStore.getState().select(el.id, "human");
    render(<Inspector />);
    expect(screen.getByRole("heading", { name: "Rectangle" })).toBeInTheDocument();
    const label = screen.getByLabelText("Label");
    await user.clear(label);
    await user.type(label, "Payment");
    expect(useCanvasStore.getState().elements[0].text).toBe("Payment");

    const width = screen.getByLabelText("W");
    fireEvent.change(width, { target: { value: "10" } });
    expect(useCanvasStore.getState().elements[0].width).toBe(MIN_NODE_W);
  });

  it("shows a group inspector when several nodes are selected", () => {
    const a = useCanvasStore.getState().addElement({ kind: "rectangle", text: "A" }, "human");
    const b = useCanvasStore.getState().addElement({ kind: "ellipse", text: "B" }, "human");
    useCanvasStore.getState().selectMany([a.id, b.id]);
    render(<Inspector />);
    expect(screen.getByRole("heading", { name: "2 selected" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
  });

  it("shows connector controls when an arrow is selected", () => {
    const a = useCanvasStore.getState().addElement({ kind: "ellipse", text: "A" }, "human");
    const b = useCanvasStore.getState().addElement({ kind: "rectangle", text: "B" }, "human");
    const conn = useCanvasStore.getState().connect(a.id, b.id, "next", "human");
    useCanvasStore.getState().select(conn!.id, "human");
    render(<Inspector />);
    expect(screen.getByRole("heading", { name: "Connector" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reverse arrow" })).toBeInTheDocument();
  });
});
