import { describe, expect, it } from "vitest";
import { confirmAction, popConfirmBypass, pushConfirmBypass } from "./confirmAction";

describe("confirmAction", () => {
  it("resolves true while bypass is active", async () => {
    pushConfirmBypass();
    await expect(confirmAction({ title: "Clear?", body: "Gone", confirmLabel: "Clear" })).resolves.toBe(true);
    popConfirmBypass();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("resolves true when the confirm button is pressed", async () => {
    const pending = confirmAction({ title: "Delete this node?", body: "Remove it.", confirmLabel: "Delete" });
    const dialog = document.querySelector("dialog.confirm-dialog");
    expect(dialog).toBeTruthy();
    expect(dialog?.querySelector("h2")?.textContent).toBe("Delete this node?");
    const confirm = dialog?.querySelector(".btn-dialog-confirm") as HTMLButtonElement;
    confirm.click();
    await expect(pending).resolves.toBe(true);
    expect(document.querySelector("dialog.confirm-dialog")).toBeNull();
  });

  it("cancels the first dialog when a second confirm opens", async () => {
    const first = confirmAction({ title: "First?", body: "One", confirmLabel: "Yes" });
    const second = confirmAction({ title: "Second?", body: "Two", confirmLabel: "Yes" });
    await expect(first).resolves.toBe(false);
    expect(document.querySelector("dialog.confirm-dialog h2")?.textContent).toBe("Second?");
    const confirm = document.querySelector(".btn-dialog-confirm") as HTMLButtonElement;
    confirm.click();
    await expect(second).resolves.toBe(true);
  });

  it("resolves false when cancelled", async () => {
    const pending = confirmAction({ title: "Clear?", body: "Gone", confirmLabel: "Clear" });
    const cancel = document.querySelector(".btn-dialog-cancel") as HTMLButtonElement;
    cancel.click();
    await expect(pending).resolves.toBe(false);
  });
});
