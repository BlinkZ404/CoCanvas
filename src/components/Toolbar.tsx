import { confirmAction } from "../confirmAction";
import { clientHitsSurface, placeShapeAt } from "../placeShape";
import { useCanvasStore } from "../store/canvasStore";
import type { ElementKind } from "../types";
import { IconConnect, IconTrash } from "./Icons";

const TOOLS: { kind: ElementKind; label: string }[] = [
  { kind: "frame", label: "Frame" },
  { kind: "rectangle", label: "Rectangle" },
  { kind: "ellipse", label: "Ellipse" },
  { kind: "text", label: "Text" },
  { kind: "sticky", label: "Sticky" },
];

const DRAG_THRESHOLD = 4;

export function Toolbar() {
  const addElement = useCanvasStore((s) => s.addElement);
  const clearAll = useCanvasStore((s) => s.clearAll);
  const canConnect = useCanvasStore((s) => s.elements.length >= 2);
  const hasContent = useCanvasStore(
    (s) => s.elements.length > 0 || s.connectors.length > 0 || s.pins.length > 0
  );
  const connectArmed = useCanvasStore((s) => s.connectArmed);
  const armConnect = useCanvasStore((s) => s.armConnect);

  async function onClear() {
    const yes = await confirmAction({
      title: "Clear the canvas?",
      body: "Removes every node, arrow, and pin. The brief stays.",
      confirmLabel: "Clear",
    });
    if (yes) clearAll("human");
  }

  function startPlace(kind: ElementKind, label: string, e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const originX = e.clientX;
    const originY = e.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    const surface = document.querySelector(".canvas-surface");

    function onMove(ev: PointerEvent) {
      if (!moved) {
        if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < DRAG_THRESHOLD) return;
        moved = true;
        ghost = document.createElement("div");
        ghost.className = "shape-drag-ghost";
        ghost.textContent = label;
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      }
      surface?.classList.toggle("is-drop-target", overCanvas(ev));
    }

    let finished = false;
    function onUp(ev: PointerEvent) {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      ghost?.remove();
      surface?.classList.remove("is-drop-target");
      if (moved) {
        if (overCanvas(ev)) placeShapeAt(kind, ev.clientX, ev.clientY);
        return;
      }
      addElement({ kind }, "human");
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <aside className="toolbar" aria-label="Insert shapes">
      <div className="toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.kind}
            className="tool-btn is-shape"
            onPointerDown={(e) => startPlace(t.kind, t.label, e)}
            title={`Drag onto the canvas, or click to add ${t.kind === "ellipse" ? "an" : "a"} ${t.label.toLowerCase()}`}
            aria-label={`Add ${t.label}`}
          >
            <span className="tool-glyph" aria-hidden>
              {t.kind === "text" ? (
                <span className="shape-swatch is-text">T</span>
              ) : (
                <span className={`shape-swatch is-${t.kind}`} />
              )}
            </span>
            <span className="tool-caption">{t.label}</span>
          </button>
        ))}
        <button
          className={`tool-btn${connectArmed ? " is-active" : ""}`}
          disabled={!canConnect}
          onClick={() => armConnect()}
          title={canConnect ? "Connect two nodes" : "Add two nodes to connect them"}
          aria-label="Connect two nodes"
          aria-pressed={connectArmed}
        >
          <span className="tool-icon">
            <IconConnect size={22} />
          </span>
          <span className="tool-caption">Connect</span>
        </button>
      </div>
      <button
        className="tool-btn tool-danger"
        disabled={!hasContent}
        onClick={() => void onClear()}
        title="Clear canvas"
        aria-label="Clear canvas"
      >
        <span className="tool-icon">
          <IconTrash size={22} />
        </span>
        <span className="tool-caption">Clear</span>
      </button>
    </aside>
  );
}

function overCanvas(ev: PointerEvent | MouseEvent) {
  const surface = document.querySelector(".canvas-surface");
  return Boolean(surface && clientHitsSurface(surface, ev.clientX, ev.clientY));
}
