/** Blocking in-page confirm for destructive actions. */

let bypass = 0;

/** Skip the dialog for scripted in-page agent tasks. */
export function pushConfirmBypass() {
  bypass += 1;
}

export function popConfirmBypass() {
  bypass = Math.max(0, bypass - 1);
}

export function resetConfirmBypass() {
  bypass = 0;
}

export function confirmAction(options: {
  title: string;
  body: string;
  confirmLabel: string;
}): Promise<boolean> {
  if (bypass > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector("dialog.confirm-dialog");
    if (existing instanceof HTMLDialogElement) {
      existing.close("cancel");
    } else {
      existing?.remove();
    }

    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("aria-labelledby", "confirm-title");
    dialog.setAttribute("aria-describedby", "confirm-body");

    const form = document.createElement("form");
    form.method = "dialog";
    form.className = "confirm-dialog-form";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      dialog.close(submitter?.value === "confirm" ? "confirm" : "cancel");
    });

    const title = document.createElement("h2");
    title.id = "confirm-title";
    title.textContent = options.title;

    const body = document.createElement("p");
    body.id = "confirm-body";
    body.textContent = options.body;

    const actions = document.createElement("div");
    actions.className = "confirm-dialog-actions";

    const cancel = document.createElement("button");
    cancel.type = "submit";
    cancel.value = "cancel";
    cancel.className = "btn-dialog-cancel";
    cancel.textContent = "Cancel";

    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.value = "confirm";
    confirm.className = "btn-dialog-confirm";
    confirm.textContent = options.confirmLabel;

    actions.append(cancel, confirm);
    form.append(title, body, actions);
    dialog.append(form);

    dialog.addEventListener("close", () => {
      const ok = dialog.returnValue === "confirm";
      dialog.remove();
      resolve(ok);
    });

    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
