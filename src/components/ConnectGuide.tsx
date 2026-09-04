import { useEffect, useRef, useState } from "react";
import { copyText } from "../clipboard";
import { CONNECT_HINT, libraryOf, type LibraryPrompt } from "../guide";
import { useCanvasStore } from "../store/canvasStore";
import { IconCheck, IconClose, IconCopy } from "./Icons";

function focusableIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  )].filter((el) => !el.hasAttribute("disabled"));
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConnectGuide({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setCopied(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.focus();

    const onDoc = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (panel?.contains(target)) return;
      if (target instanceof Element && target.closest("button.status")) return;
      onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusableIn(panel);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, [open, onClose]);

  async function copyPrompt(text: string) {
    if (!(await copyText(text))) {
      setCopied(null);
      return;
    }
    setCopied(text);
    window.setTimeout(() => {
      setCopied((prev) => (prev === text ? null : prev));
    }, 1400);
  }

  function pickLibraryRow(row: LibraryPrompt) {
    if (row.brief) useCanvasStore.getState().setBrief(row.brief, "human");
    void copyPrompt(row.prompt);
  }

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="connect-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-title"
      aria-describedby="connect-hint"
      tabIndex={-1}
    >
      <div className="connect-guide-head">
        <div className="connect-guide-title-row">
          <h2 id="connect-title">Connect an agent</h2>
          <button type="button" className="connect-guide-close" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>
        <p id="connect-hint" className="connect-guide-hint">
          {CONNECT_HINT}
        </p>
      </div>
      <div className="connect-prompts">
        <ConnectPromptGroup label="Prompt" rows={libraryOf("prompt")} copied={copied} onPick={pickLibraryRow} />
        <ConnectPromptGroup label="Demo" rows={libraryOf("demo")} copied={copied} onPick={pickLibraryRow} />
      </div>
    </div>
  );
}

function ConnectPromptGroup({
  label,
  rows,
  copied,
  onPick,
}: {
  label: string;
  rows: LibraryPrompt[];
  copied: string | null;
  onPick: (row: LibraryPrompt) => void;
}) {
  return (
    <div className="connect-prompt-group">
      <h3 className="connect-group-label">{label}</h3>
      <ul>
        {rows.map((row) => {
          const justCopied = copied === row.prompt;
          return (
            <li key={row.id}>
              <button type="button" className="connect-prompt" onClick={() => onPick(row)}>
                <span>
                  <span className="connect-prompt-title">{row.title}</span>
                  <span className="connect-prompt-hint">{row.hint}</span>
                </span>
                <span className="connect-prompt-copy" aria-hidden>
                  {justCopied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                </span>
                <span className="sr-only">{justCopied ? "Copied" : "Copy"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
