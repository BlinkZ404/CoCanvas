import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { MobileDock, type DockTab } from "./MobileDock";

function DockProbe() {
  const [tab, setTab] = useState<DockTab | null>(null);
  return <MobileDock tab={tab} onChange={setTab} />;
}

describe("MobileDock", () => {
  it("selects a tab and collapses it on a second tap", async () => {
    const user = userEvent.setup();
    render(<DockProbe />);
    const agent = screen.getByRole("tab", { name: "Agent" });
    expect(agent).toHaveAttribute("aria-selected", "false");
    await user.click(agent);
    expect(agent).toHaveAttribute("aria-selected", "true");
    await user.click(agent);
    expect(agent).toHaveAttribute("aria-selected", "false");
  });
});
