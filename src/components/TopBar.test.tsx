import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("shows Not connected and opens the guide", async () => {
    const user = userEvent.setup();
    render(<TopBar connected={false} />);
    const status = screen.getByRole("button", { name: "Not connected" });
    await user.click(status);
    expect(screen.getByRole("dialog", { name: /connect an agent/i })).toBeInTheDocument();
  });

  it("undoes from the header", async () => {
    const user = userEvent.setup();
    useCanvasStore.getState().addElement({ kind: "sticky" }, "human");
    render(<TopBar connected />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(useCanvasStore.getState().elements).toHaveLength(0);
  });
});
