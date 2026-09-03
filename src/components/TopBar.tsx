import { useCallback, useState } from "react";
import { BriefBar } from "./BriefBar";
import { ConnectGuide } from "./ConnectGuide";
import { IconRedo, IconUndo, LogoMark } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";
import { useCanvasStore } from "../store/canvasStore";

interface Props {
  connected: boolean;
}

export function TopBar({ connected }: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const undoDepth = useCanvasStore((s) => s.undoDepth);
  const redoDepth = useCanvasStore((s) => s.redoDepth);

  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark />
        <h1>CoCanvas</h1>
      </div>
      <div className="topbar-edit">
        <button
          type="button"
          className="topbar-icon"
          disabled={undoDepth === 0}
          onClick={() => undo()}
          title={undoDepth === 0 ? "Nothing to undo" : "Undo"}
          aria-label="Undo"
        >
          <IconUndo size={18} />
        </button>
        <button
          type="button"
          className="topbar-icon"
          disabled={redoDepth === 0}
          onClick={() => redo()}
          title={redoDepth === 0 ? "Nothing to redo" : "Redo"}
          aria-label="Redo"
        >
          <IconRedo size={18} />
        </button>
      </div>
      <BriefBar />
      <ThemeToggle />
      <div className="status-wrap">
        {connected ? (
          <span className="status is-live" title="An agent can use the tools on this page.">
            <span className="status-dot" aria-hidden />
            <span className="status-label">Connected</span>
          </span>
        ) : (
          <button
            type="button"
            className={`status is-local${guideOpen ? " is-open" : ""}`}
            onClick={() => setGuideOpen((open) => !open)}
            aria-haspopup="dialog"
            aria-expanded={guideOpen}
            aria-label="Not connected"
          >
            <span className="status-dot" aria-hidden />
            <span className="status-label">Not connected</span>
          </button>
        )}
        <ConnectGuide open={guideOpen} onClose={closeGuide} />
      </div>
    </header>
  );
}
