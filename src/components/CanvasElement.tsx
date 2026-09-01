import { useRef, type RefObject } from "react";
import { useCanvasStore } from "../store/canvasStore";
import type { CanvasElement } from "../types";

interface Props {
  element: CanvasElement;
  surfaceRef: RefObject<HTMLDivElement>;
}

export function CanvasElementView({ element, surfaceRef }: Props) {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const select = useCanvasStore((s) => s.select);
  const moveElement = useCanvasStore((s) => s.moveElement);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const dragState = useRef<{ dx: number; dy: number } | null>(null);

  const selected = selectedId === element.id;

  function onMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    select(element.id, "human");
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    dragState.current = {
      dx: e.clientX - rect.left - element.x + surface.scrollLeft,
      dy: e.clientY - rect.top - element.y + surface.scrollTop,
    };

    function onMove(ev: MouseEvent) {
      if (!dragState.current || !surface) return;
      const r = surface.getBoundingClientRect();
      const x = ev.clientX - r.left - dragState.current.dx + surface.scrollLeft;
      const y = ev.clientY - r.top - dragState.current.dy + surface.scrollTop;
      moveElement(element.id, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), "human");
    }
    function onUp() {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const baseStyle: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.z + (selected ? 1000 : 0),
  };

  const editable = element.kind === "text" || element.kind === "sticky" || element.kind === "frame";

  function onTextInput(e: React.FormEvent<HTMLDivElement>) {
    updateElement(element.id, { text: e.currentTarget.textContent ?? "" }, "human");
  }

  const cls = `el el-${element.kind}${selected ? " el-selected" : ""}`;

  const handles = selected ? (
    <div className="el-handles" aria-hidden>
      <i className="h nw" />
      <i className="h ne" />
      <i className="h sw" />
      <i className="h se" />
    </div>
  ) : null;

  if (element.kind === "frame") {
    return (
      <div
        className={cls}
        style={{ ...baseStyle, borderColor: element.stroke, background: element.fill }}
        onMouseDown={onMouseDown}
      >
        {handles}
        <div className="frame-title" contentEditable suppressContentEditableWarning onInput={onTextInput}>
          {element.text}
        </div>
      </div>
    );
  }

  if (element.kind === "text") {
    return (
      <div
        className={cls}
        style={{ ...baseStyle, color: element.fill, fontSize: element.fontSize }}
        onMouseDown={onMouseDown}
      >
        {handles}
        <div contentEditable suppressContentEditableWarning onInput={onTextInput} className="text-body">
          {element.text}
        </div>
      </div>
    );
  }

  if (element.kind === "sticky") {
    return (
      <div
        className={cls}
        style={{
          ...baseStyle,
          background: element.fill,
          borderColor: element.stroke,
          fontSize: element.fontSize,
        }}
        onMouseDown={onMouseDown}
      >
        {handles}
        <div contentEditable suppressContentEditableWarning onInput={onTextInput} className="sticky-body">
          {element.text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cls}
      style={{
        ...baseStyle,
        background: element.fill,
        borderColor: element.stroke,
        color: contrastText(element.fill),
        borderRadius: element.kind === "ellipse" ? "50%" : 14,
        fontSize: element.fontSize,
      }}
      onMouseDown={onMouseDown}
    >
      {handles}
      {editable ? null : <span className="shape-label">{element.text}</span>}
    </div>
  );
}

function contrastText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#fff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1a1a1e" : "#fff";
}
