import { useEffect, useState } from "react";
import { AgentConsole } from "./components/AgentConsole";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { MobileDock, type DockTab } from "./components/MobileDock";
import { Toolbar } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { confirmAction } from "./confirmAction";
import { downloadBoardPng } from "./exportBoard";
import { KIND_LABEL } from "./labels";
import { useCanvasStore } from "./store/canvasStore";
import { registerCoCanvasTools, subscribeRegistration, type RegistrationInfo } from "./webmcp/registerTools";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export default function App() {
  const [reg, setReg] = useState<RegistrationInfo | null>(null);
  const [dockTab, setDockTab] = useState<DockTab | null>(null);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectedCount = useCanvasStore((s) => s.selectedIds.length);

  useEffect(() => {
    try {
      setReg(registerCoCanvasTools());
    } catch {
      setReg(null);
      return;
    }
    return subscribeRegistration(setReg);
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
      const nodeIds = new Set(store.elements.map((item) => item.id));
      const group = store.selectedIds.filter((sid) => nodeIds.has(sid));
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

      if (mod && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        store.selectMany(store.elements.map((item) => item.id));
        return;
      }

      if (mod && (e.key === "e" || e.key === "E") && store.elements.length > 0) {
        e.preventDefault();
        void downloadBoardPng(store).then((name) => {
          useCanvasStore.getState().log("human", `exported ${name}`);
        });
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

      if ((e.key === "Delete" || e.key === "Backspace") && (group.length || id)) {
        e.preventDefault();
        if (group.length > 1) {
          void confirmAction({
            title: "Delete these nodes?",
            body: `Delete ${group.length} nodes and any arrows or pins on them.`,
            confirmLabel: "Delete",
          }).then((yes) => {
            if (yes) useCanvasStore.getState().deleteElements(group, "human");
          });
          return;
        }
        if (el) {
          void confirmAction({
            title: "Delete this node?",
            body: `Delete this ${KIND_LABEL[el.kind]} and any arrows or pins on it.`,
            confirmLabel: "Delete",
          }).then((yes) => {
            if (yes) useCanvasStore.getState().deleteElement(id!, "human");
          });
          return;
        }
        if (id) {
          void confirmAction({
            title: "Delete this connector?",
            body: "Remove this arrow from the board.",
            confirmLabel: "Delete",
          }).then((yes) => {
            if (yes) useCanvasStore.getState().deleteConnector(id, "human");
          });
        }
        return;
      }

      if (!el && group.length === 0) return;

      if (mod && (e.key === "d" || e.key === "D") && group.length) {
        e.preventDefault();
        store.beginGesture();
        const copies = group
          .map((sid) => store.duplicateElement(sid, "human"))
          .filter((copy): copy is NonNullable<typeof copy> => Boolean(copy));
        store.endGesture();
        store.selectMany(copies.map((copy) => copy.id));
        return;
      }

      if (el && (e.key === "]" || e.key === "[")) {
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
      if (dir && group.length) {
        e.preventDefault();
        if (!nudgeHeld) {
          nudgeHeld = true;
          store.beginGesture();
        }
        for (const sid of group) {
          store.nudgeElement(sid, dir[0] * step, dir[1] * step, "human", { log: false });
        }
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

  useEffect(() => {
    if (!selectedId && selectedCount === 0) return;
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches) return;
    setDockTab((tab) => (tab === "agent" ? "agent" : "properties"));
  }, [selectedId, selectedCount]);

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
        <aside
          className={`side${dockTab ? ` is-open dock-${dockTab}` : " is-collapsed"}`}
          aria-label="Inspector and agent"
        >
          <MobileDock tab={dockTab} onChange={setDockTab} />
          <div className="dock-panels">
            <Inspector />
            <AgentConsole modelContext={reg?.modelContext ?? null} />
          </div>
        </aside>
      </div>
    </div>
  );
}
