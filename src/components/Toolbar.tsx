import { useEffect, useRef, useState, type ComponentType } from "react";
import { useCanvasStore } from "../store/canvasStore";
import type { ElementKind } from "../types";
import { IconEllipse, IconFrame, IconRect, IconSticky, IconText, IconTrash, IconUndo } from "./Icons";

const TOOLS: { kind: ElementKind; label: string; Icon: ComponentType }[] = [
  { kind: "frame", label: "Frame", Icon: IconFrame },
  { kind: "rectangle", label: "Rectangle", Icon: IconRect },
  { kind: "ellipse", label: "Ellipse", Icon: IconEllipse },
  { kind: "text", label: "Text", Icon: IconText },
  { kind: "sticky", label: "Sticky", Icon: IconSticky },
];

export function Toolbar() {
  const addElement = useCanvasStore((s) => s.addElement);
  const clearAll = useCanvasStore((s) => s.clearAll);
  const undoAgent = useCanvasStore((s) => s.undoAgent);
  const agentUndoDepth = useCanvasStore((s) => s.agentUndoDepth);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current != null) window.clearTimeout(confirmTimer.current);
    };
  }, []);

  return (
    <aside className="toolbar" aria-label="Insert elements">
      <div className="toolbar-group">
        <span className="toolbar-title">Add</span>
        {TOOLS.map((t) => (
          <button
            key={t.kind}
            className="tool-btn"
            onClick={() => addElement({ kind: t.kind }, "human")}
            title={`Add ${t.label}`}
            aria-label={`Add ${t.label}`}
          >
            <span className="tool-icon">
              <t.Icon />
            </span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-group toolbar-footer">
        <button
          className="tool-btn"
          disabled={agentUndoDepth === 0}
          onClick={() => undoAgent()}
          title={agentUndoDepth === 0 ? "No agent change to undo" : "Undo the last agent change"}
          aria-label="Undo the last agent change"
        >
          <span className="tool-icon">
            <IconUndo />
          </span>
          <span className="tool-label">Undo agent</span>
        </button>
        <button
          className={`tool-btn tool-danger${confirmClear ? " is-confirm" : ""}`}
          onClick={() => {
            if (!confirmClear) {
              setConfirmClear(true);
              if (confirmTimer.current != null) window.clearTimeout(confirmTimer.current);
              confirmTimer.current = window.setTimeout(() => setConfirmClear(false), 2500);
              return;
            }
            clearAll("human");
            setConfirmClear(false);
          }}
          title={confirmClear ? "Click again to clear the canvas" : "Clear canvas"}
          aria-label={confirmClear ? "Confirm clear canvas" : "Clear canvas"}
        >
          <span className="tool-icon">
            <IconTrash />
          </span>
          <span className="tool-label">{confirmClear ? "Sure?" : "Clear"}</span>
        </button>
      </div>
    </aside>
  );
}
