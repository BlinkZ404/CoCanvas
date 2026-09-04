import { useCallback, useEffect, useRef, useState } from "react";
import { boardExtent, boxesOverlap, scrollBoardFromPointer } from "../geometry/board";
import { connectorLabelBox, connectorLayout } from "../geometry/connectors";
import { boardPointFromClient } from "../placeShape";
import { useCanvasStore } from "../store/canvasStore";
import { isDarkColor, isInkPaper } from "../theme";
import { ZOOM_MAX, ZOOM_MIN, clampZoom, nudgeZoom, scrollAfterZoom } from "../view";
import { CanvasElementView } from "./CanvasElement";

function isBoardBackground(target: EventTarget | null, surface: HTMLElement | null) {
  if (!(target instanceof Element) || !surface) return false;
  return (
    target === surface ||
    target.classList.contains("canvas-world") ||
    target.classList.contains("canvas-sizer") ||
    target.classList.contains("canvas-grid")
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function Canvas() {
  const elements = useCanvasStore((s) => s.elements);
  const connectors = useCanvasStore((s) => s.connectors);
  const background = useCanvasStore((s) => s.background);
  const select = useCanvasStore((s) => s.select);
  const selectMany = useCanvasStore((s) => s.selectMany);
  const resetViewNonce = useCanvasStore((s) => s.resetViewNonce);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectedIds = useCanvasStore((s) => s.selectedIds ?? []);
  const connectArmed = useCanvasStore((s) => s.connectArmed);
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const cancelConnect = useCanvasStore((s) => s.cancelConnect);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState({ w: 800, h: 600 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const extent = boardExtent(elements);
  const worldW = Math.max(extent?.width ?? 0, view.w);
  const worldH = Math.max(extent?.height ?? 0, view.h);

  const applyZoom = useCallback((next: number, clientX?: number, clientY?: number) => {
    const surface = surfaceRef.current;
    const current = zoomRef.current;
    const clamped = clampZoom(next);
    if (clamped === current) return;
    if (surface) {
      const rect = surface.getBoundingClientRect();
      const cx = clientX ?? rect.left + rect.width / 2;
      const cy = clientY ?? rect.top + rect.height / 2;
      surface.dataset.zoom = String(clamped);
      zoomRef.current = clamped;
      setZoom(clamped);
      requestAnimationFrame(() => {
        scrollAfterZoom(surface, current, clamped, cx, cy);
      });
      return;
    }
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") return;
    const measure = () => setView({ w: Math.max(1, surface.clientWidth), h: Math.max(1, surface.clientHeight) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(surface);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    zoomRef.current = 1;
    setZoom(1);
    const surface = surfaceRef.current;
    if (surface) surface.dataset.zoom = "1";
    surface?.scrollTo?.({ left: 0, top: 0 });
  }, [resetViewNonce]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface) surface.dataset.zoom = String(zoom);
  }, [zoom]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dir: 1 | -1 = e.deltaY < 0 ? 1 : -1;
      applyZoom(nudgeZoom(zoomRef.current, dir), e.clientX, e.clientY);
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("dialog.confirm-dialog")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        applyZoom(nudgeZoom(zoomRef.current, 1));
      } else if (e.key === "-") {
        e.preventDefault();
        applyZoom(nudgeZoom(zoomRef.current, -1));
      } else if (e.key === "0") {
        e.preventDefault();
        applyZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyZoom]);

  const byId = new Map(elements.map((e) => [e.id, e]));
  const darkSurface = isDarkColor(background);
  const inkPaper = isInkPaper(background);

  return (
    <div className="canvas-stack">
      <main
        id="canvas-board"
        className={`canvas-surface${darkSurface ? " is-dark" : ""}${inkPaper ? " is-ink" : ""}${connectArmed ? " is-connecting" : ""}`}
        ref={surfaceRef}
        tabIndex={-1}
        aria-label="Canvas"
        data-zoom={zoom}
        style={{ backgroundColor: background }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const surface = surfaceRef.current;
          if (!isBoardBackground(e.target, surface) || !surface) return;
          if (connectArmed) {
            cancelConnect();
            return;
          }
          const additive = e.shiftKey;
          if (!additive) select(null, "human");
          const start = boardPointFromClient(surface, e.clientX, e.clientY);
          let box = { x: start.x, y: start.y, width: 0, height: 0 };
          let moved = false;

          function onMove(ev: PointerEvent) {
            if (!surface) return;
            scrollBoardFromPointer(surface, ev.clientX, ev.clientY);
            const now = boardPointFromClient(surface, ev.clientX, ev.clientY);
            box = {
              x: Math.min(start.x, now.x),
              y: Math.min(start.y, now.y),
              width: Math.abs(now.x - start.x),
              height: Math.abs(now.y - start.y),
            };
            if (!moved) {
              if (Math.hypot(now.x - start.x, now.y - start.y) < 4) return;
              moved = true;
            }
            setMarquee(box);
          }

          function onUp() {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            setMarquee(null);
            if (!moved) return;
            const hits = useCanvasStore
              .getState()
              .elements.filter((el) => boxesOverlap(el, box))
              .map((el) => el.id);
            if (additive) {
              const live = useCanvasStore.getState();
              const nodes = new Set(live.elements.map((el) => el.id));
              selectMany([...live.selectedIds.filter((id) => nodes.has(id)), ...hits]);
            } else {
              selectMany(hits);
            }
          }

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        }}
      >
        <div className="canvas-sizer" style={{ width: worldW * zoom, height: worldH * zoom }}>
          <div
            className="canvas-world"
            style={{ width: worldW, height: worldH, transform: `scale(${zoom})` }}
          >
            <div className="canvas-grid" aria-hidden />
            <svg className="connector-layer" aria-hidden>
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="8"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill={darkSurface ? "#c9d0dc" : "#6b7280"} />
                </marker>
              </defs>
              {connectors.map((c) => {
                const from = byId.get(c.from);
                const to = byId.get(c.to);
                if (!from || !to) return null;
                const geo = connectorLayout(from, to);
                const labelBox = connectorLabelBox(c.label, geo);
                const labelHits = elements.some(
                  (el) => el.id !== c.from && el.id !== c.to && boxesOverlap(el, labelBox)
                );
                const showLabel = Boolean(c.label) && geo.length >= 44 && !labelHits;
                const arrowSelected = selectedId === c.id || selectedIds.includes(c.id);
                return (
                  <g key={c.id}>
                    <path
                      className="connector-hit"
                      d={geo.d}
                      fill="none"
                      style={{ pointerEvents: "stroke" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.button !== 0) return;
                        if (connectArmed) return;
                        select(c.id, "human");
                      }}
                    />
                    <path
                      d={geo.d}
                      fill="none"
                      className={arrowSelected ? "connector-line is-selected" : "connector-line"}
                      stroke={arrowSelected ? undefined : darkSurface ? "#c3cad6" : "#7b8494"}
                      strokeWidth={arrowSelected ? undefined : 1.75}
                      markerEnd="url(#arrowhead)"
                    />
                    {showLabel ? (
                      <g>
                        <rect
                          x={labelBox.x}
                          y={labelBox.y}
                          width={labelBox.width}
                          height={labelBox.height}
                          rx={9}
                          fill={darkSurface ? "#2a2e36" : "#f6f4ef"}
                          stroke={darkSurface ? "#6b7280" : "#d8d3c8"}
                        />
                        <text x={geo.labelX} y={geo.labelY + 2} className="connector-label" textAnchor="middle">
                          {c.label}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {elements.length === 0 ? (
              <div className="empty-hint">
                <p>Drag a shape from the toolbar, or click one.</p>
                <p>Ctrl plus scroll zooms. Shift-click or drag to select several.</p>
              </div>
            ) : null}

            {elements.map((el) => (
              <CanvasElementView key={el.id} element={el} surfaceRef={surfaceRef} />
            ))}
            {marquee ? (
              <div
                className="marquee"
                style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
              />
            ) : null}
          </div>
        </div>
      </main>
      <div className="zoom-dock" role="group" aria-label="Zoom">
        <button
          type="button"
          className="zoom-btn"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => applyZoom(nudgeZoom(zoom, -1))}
        >
          -
        </button>
        <button type="button" className="zoom-reset" aria-label="Reset zoom" onClick={() => applyZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="zoom-btn"
          aria-label="Zoom in"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => applyZoom(nudgeZoom(zoom, 1))}
        >
          +
        </button>
      </div>
      {connectArmed ? (
        <div className="connect-hint" role="status">
          <span>{connectFromId ? "Click the end node" : "Click the start node"}</span>
          <button type="button" className="connect-hint-cancel" onClick={cancelConnect}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
