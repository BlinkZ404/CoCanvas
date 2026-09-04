import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { resizeByHandle, scrollBoardFromPointer, type ResizeHandle } from "../geometry/board";
import { elementName, headingLines } from "../labels";
import { boardPointFromClient } from "../placeShape";
import { useCanvasStore } from "../store/canvasStore";
import { rectangleRole } from "../design";
import { inkOnBoard, luminance } from "../theme";
import type { CanvasElement } from "../types";

interface Props {
  element: CanvasElement;
  surfaceRef: RefObject<HTMLDivElement>;
}

const HANDLES: ResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const DRAG_THRESHOLD = 4;

const CURSOR: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

export function CanvasElementView({ element, surfaceRef }: Props) {
  const selectedIds = useCanvasStore((s) => s.selectedIds ?? []);
  const select = useCanvasStore((s) => s.select);
  const moveElement = useCanvasStore((s) => s.moveElement);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const connectArmed = useCanvasStore((s) => s.connectArmed);
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const pickConnect = useCanvasStore((s) => s.pickConnect);
  const pinCount = useCanvasStore(
    (s) => s.pins.filter((p) => p.elementId === element.id && !p.resolved).length
  );
  const background = useCanvasStore((s) => s.background);
  const textInk = inkOnBoard(element.fill, background);
  const dragState = useRef<{
    dx: number;
    dy: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const resizeState = useRef<{
    handle: ResizeHandle;
    x: number;
    y: number;
    w: number;
    h: number;
    mx: number;
    my: number;
  } | null>(null);

  const selected = selectedIds.includes(element.id);
  const connectFrom = connectFromId === element.id;
  const showHandles = selected && selectedIds.length === 1;

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    if (connectArmed) {
      pickConnect(element.id);
      return;
    }
    if (e.shiftKey) select(element.id, "human", { additive: true });
    else if (!selectedIds.includes(element.id)) select(element.id, "human");
    const target = e.target as HTMLElement;
    if (target.isContentEditable) return;
    if (e.button !== 0) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const live = useCanvasStore.getState();
    const nodeIds = new Set(live.elements.map((item) => item.id));
    const group = live.selectedIds.filter((id) => nodeIds.has(id));
    if (!group.includes(element.id)) return;
    const origins = group
      .map((id) => live.elements.find((item) => item.id === id))
      .filter((item): item is CanvasElement => Boolean(item))
      .map((item) => ({ id: item.id, x: item.x, y: item.y }));
    useCanvasStore.getState().beginGesture();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const start = boardPointFromClient(surface, e.clientX, e.clientY);
    dragState.current = {
      dx: start.x - element.x,
      dy: start.y - element.y,
      ox: element.x,
      oy: element.y,
      moved: false,
    };

    function onMove(ev: PointerEvent) {
      if (!dragState.current || !surface) return;
      scrollBoardFromPointer(surface, ev.clientX, ev.clientY);
      const now = boardPointFromClient(surface, ev.clientX, ev.clientY);
      const x = Math.max(0, Math.round(now.x - dragState.current.dx));
      const y = Math.max(0, Math.round(now.y - dragState.current.dy));
      if (!dragState.current.moved) {
        const dist = Math.hypot(x - dragState.current.ox, y - dragState.current.oy);
        if (dist < DRAG_THRESHOLD) return;
        dragState.current.moved = true;
      }
      const dx = x - dragState.current.ox;
      const dy = y - dragState.current.oy;
      for (const origin of origins) {
        moveElement(origin.id, origin.x + dx, origin.y + dy, "human", { log: false });
      }
    }
    function onUp() {
      const drag = dragState.current;
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (drag?.moved) {
        const count = origins.length;
        useCanvasStore.getState().log(
          "human",
          count === 1
            ? `moved ${elementName(useCanvasStore.getState().elements.find((item) => item.id === element.id) ?? element)}`
            : `moved ${count} nodes`
        );
      }
      useCanvasStore.getState().endGesture();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onResizeDown(e: React.PointerEvent, handle: ResizeHandle) {
    e.stopPropagation();
    e.preventDefault();
    if (connectArmed) return;
    if (e.button !== 0) return;
    const board = surfaceRef.current;
    if (!board) return;
    const surface: HTMLElement = board;
    select(element.id, "human");
    useCanvasStore.getState().beginGesture();
    const start = boardPointFromClient(surface, e.clientX, e.clientY);
    resizeState.current = {
      handle,
      x: element.x,
      y: element.y,
      w: element.width,
      h: element.height,
      mx: start.x,
      my: start.y,
    };
    document.body.style.cursor = CURSOR[handle];
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    function onMove(ev: PointerEvent) {
      const s = resizeState.current;
      if (!s) return;
      scrollBoardFromPointer(surface, ev.clientX, ev.clientY);
      const now = boardPointFromClient(surface, ev.clientX, ev.clientY);
      const next = resizeByHandle(s, s.handle, now.x - s.mx, now.y - s.my);
      updateElement(element.id, next, "human", { log: false });
    }
    function onUp() {
      const did = resizeState.current;
      resizeState.current = null;
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (did) {
        const live = useCanvasStore.getState().elements.find((e) => e.id === element.id) ?? element;
        if (live.x !== did.x || live.y !== did.y || live.width !== did.w || live.height !== did.h) {
          useCanvasStore.getState().log("human", `resized ${elementName(live)}`);
        }
      }
      useCanvasStore.getState().endGesture();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const baseStyle: CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.z + (selected ? 1000 : 0),
  };

  function onLiveText(text: string) {
    updateElement(element.id, { text }, "human", { log: false });
  }

  const role = rectangleRole(element);
  const cls = `el el-${element.kind}${selected ? " el-selected" : ""}${connectFrom ? " el-connect-from" : ""}${role ? ` is-${role}` : ""}`;

  const handles = showHandles ? (
    <div className="el-handles">
      {HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          className={`h ${handle}`}
          tabIndex={-1}
          aria-label={`Resize ${handle}`}
          onPointerDown={(e) => onResizeDown(e, handle)}
        />
      ))}
    </div>
  ) : null;

  const pinBadge =
    pinCount > 0 ? (
      <span className="el-pin" title={`${pinCount} open pin${pinCount === 1 ? "" : "s"}`}>
        {pinCount}
      </span>
    ) : null;

  const chrome = { handles, pinBadge, onPointerDown };

  if (element.kind === "frame") {
    return (
      <NodeShell
        className={cls}
        style={{ ...baseStyle, borderColor: element.stroke, background: element.fill }}
        {...chrome}
      >
        <EditableText
          className="frame-title"
          value={element.text}
          disabled={connectArmed}
          onChange={onLiveText}
        />
      </NodeShell>
    );
  }

  if (element.kind === "text") {
    return (
      <NodeShell
        className={cls}
        style={{ ...baseStyle, color: textInk, fontSize: element.fontSize }}
        {...chrome}
      >
        <EditableText
          className="text-body"
          value={element.text}
          disabled={connectArmed}
          onChange={onLiveText}
        />
      </NodeShell>
    );
  }

  if (element.kind === "sticky") {
    return (
      <NodeShell
        className={cls}
        style={{
          ...baseStyle,
          background: element.fill,
          borderColor: element.stroke,
          fontSize: element.fontSize,
        }}
        {...chrome}
      >
        <EditableText
          className="sticky-body"
          value={element.text}
          disabled={connectArmed}
          onChange={onLiveText}
        />
      </NodeShell>
    );
  }

  return (
    <NodeShell
      className={cls}
      style={{
        ...baseStyle,
        background: element.fill,
        borderColor: element.stroke,
        color: contrastText(element.fill),
        borderRadius: element.kind === "ellipse" ? "50%" : undefined,
        fontSize: element.fontSize,
      }}
      {...chrome}
    >
      <NodeLabel text={element.text} />
    </NodeShell>
  );
}

function NodeLabel({ text }: { text: string }) {
  const { kicker, detail } = headingLines(text);
  if (!kicker) return <span className="shape-label">{detail}</span>;
  return (
    <span className="shape-label is-stacked">
      <span className="shape-kicker">{kicker}</span>
      <span className="shape-detail">{detail}</span>
    </span>
  );
}

function NodeShell({
  className,
  style,
  onPointerDown,
  handles,
  pinBadge,
  children,
}: {
  className: string;
  style: CSSProperties;
  onPointerDown: (e: ReactPointerEvent) => void;
  handles: ReactNode;
  pinBadge: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={className} style={style} onPointerDown={onPointerDown}>
      {handles}
      {pinBadge}
      {children}
    </div>
  );
}

function EditableText({
  value,
  className,
  disabled,
  onChange,
}: {
  value: string;
  className?: string;
  disabled?: boolean;
  onChange: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (document.activeElement === node) return;
    if (node.textContent !== value) node.textContent = value;
  }, [value]);

  return (
    <div
      ref={ref}
      className={className}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onFocus={() => useCanvasStore.getState().beginGesture()}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onInput={(e) => {
        const node = e.currentTarget;
        const text = node.textContent ?? "";
        if (node.childElementCount > 0) node.replaceChildren(document.createTextNode(text));
        onChange(text);
      }}
      onBlur={() => useCanvasStore.getState().endGesture()}
    />
  );
}

function contrastText(hex: string): string {
  if (hex.replace("#", "").length !== 6) return "#fff";
  return luminance(hex) > 0.62 ? "#1a1a1e" : "#fff";
}
