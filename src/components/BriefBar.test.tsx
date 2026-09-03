import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useCanvasStore } from "../store/canvasStore";
import { BriefBar } from "./BriefBar";

describe("BriefBar", () => {
  it("writes the brief on blur so undo can capture it", async () => {
    const user = userEvent.setup();
    render(<BriefBar />);
    const input = screen.getByRole("textbox", { name: "Brief" });
    await user.type(input, "Cart review");
    await user.tab();
    expect(useCanvasStore.getState().brief).toBe("Cart review");
  });
});
