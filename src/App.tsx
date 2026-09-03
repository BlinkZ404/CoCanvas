import { useEffect, useState } from "react";
import { AgentConsole } from "./components/AgentConsole";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { Toolbar } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { confirmAction } from "./confirmAction";
import { KIND_LABEL } from "./labels";
import { useCanvasStore } from "./store/canvasStore";
import { registerCoCanvasTools, type RegistrationInfo } from "./webmcp/registerTools";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export default function App() {
  const [reg, setReg] = useState<RegistrationInfo | null>(null);

  useEffect(() => {
    let info: RegistrationInfo;
    try {
      info = registerCoCanvasTools();
    } catch {
      setReg(null);
      return;
    }
    setReg(info);
  }, []);

  useEffect(() => {
    let nudgeTimer = 0;
    let nudgeHeld = false;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog.confirm-dialog")) return;
      const store = useCanvasStore.getState();
      if (e.key === "Escape") {
        store.cancelConnect();
        store.select(null, "human");
        return;
      }
      const id = store.selectedId;
      const el = id ? store.elements.find((item) => item.id === id) : undefined;
      const mod = e.metaKey || e.ctrlKey;
      const typing = isTypingTarget(e.target);

      if (typing) {
        if (el && mod && (e.key === "d" || e.key === "D")) {
          e.preventDefault();
          store.duplicateElement(el.id, "human");
        } else if (el && mod && (e.key === "]" || e.key === "[")) {
          e.preventDefault();
          store.layerElement(el.id, e.key === "]" ? "front" : "back", "human");
        }
        return;
      }

      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        store.redo();
        return;
      }

      if (id && !el && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        store.reverseConnector(id, "human");
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && id) {
        e.preventDefault();
        if (el) {
          void confirmAction({
            title: "Delete this node?",
            body: `Delete this ${KIND_LABEL[el.kind]} and any arrows or pins on it.`,
            confirmLabel: "Delete",
          }).then((yes) => {
            if (yes) useCanvasStore.getState().deleteElement(id, "human");
          });
          return;
        }
        void confirmAction({
          title: "Delete this connector?",
          body: "Remove this arrow from the board.",
          confirmLabel: "Delete",
        }).then((yes) => {
          if (yes) useCanvasStore.getState().deleteConnector(id, "human");
        });
        return;
      }

      if (!el) return;

      if (mod && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        store.duplicateElement(el.id, "human");
        return;
      }

      if (e.key === "]" || e.key === "[") {
        e.preventDefault();
        if (mod && e.key === "]") store.layerElement(el.id, "front", "human");
        else if (mod && e.key === "[") store.layerElement(el.id, "back", "human");
        else if (e.key === "]") store.layerElement(el.id, "forward", "human");
        else store.layerElement(el.id, "backward", "human");
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const dir = nudge[e.key];
      if (dir) {
        e.preventDefault();
        if (!nudgeHeld) {
          nudgeHeld = true;
          store.beginGesture();
        }
        store.nudgeElement(el.id, dir[0] * step, dir[1] * step, "human", { log: false });
        window.clearTimeout(nudgeTimer);
        nudgeTimer = window.setTimeout(() => {
          useCanvasStore.getState().endGesture();
          nudgeHeld = false;
        }, 400);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(nudgeTimer);
      if (nudgeHeld) useCanvasStore.getState().endGesture();
    };
  }, []);

  // Pin the chrome. Only the board should scroll.
  useEffect(() => {
    const pinnedSelectors = [".app", ".workspace"];
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target === document || target === document.documentElement || target === document.body) {
        const de = document.documentElement;
        if (de.scrollLeft) de.scrollLeft = 0;
        if (de.scrollTop) de.scrollTop = 0;
        if (document.body.scrollLeft) document.body.scrollLeft = 0;
        if (document.body.scrollTop) document.body.scrollTop = 0;
        return;
      }
      if (target instanceof Element && pinnedSelectors.some((sel) => target.matches(sel))) {
        if (target.scrollLeft) target.scrollLeft = 0;
        if (target.scrollTop) target.scrollTop = 0;
      }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#canvas-board"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("canvas-board")?.focus();
        }}
      >
        Skip to canvas
      </a>
      <TopBar connected={!(reg?.polyfilled ?? true)} />
      <div className="workspace">
        <Toolbar />
        <div className="canvas-col">
          <Canvas />
        </div>
        <aside className="side" aria-label="Inspector and agent">
          <Inspector />
          <AgentConsole modelContext={reg?.modelContext ?? null} />
        </aside>
      </div>
    </div>
  );
}
