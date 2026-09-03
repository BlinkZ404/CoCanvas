import { useEffect, useRef } from "react";
import { boardExtent } from "../geometry/board";
import { connectorLayout } from "../geometry/connectors";
import { useCanvasStore } from "../store/canvasStore";
import { isDarkColor } from "../theme";
import { CanvasElementView } from "./CanvasElement";

function isBoardBackground(target: EventTarget | null, surface: HTMLElement | null) {
  if (!(target instanceof Element) || !surface) return false;
  return target === surface || target.classList.contains("canvas-world") || target.classList.contains("canvas-grid");
}

export function Canvas() {
  const elements = useCanvasStore((s) => s.elements);
  const connectors = useCanvasStore((s) => s.connectors);
  const background = useCanvasStore((s) => s.background);
  const select = useCanvasStore((s) => s.select);
  const resetViewNonce = useCanvasStore((s) => s.resetViewNonce);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const connectArmed = useCanvasStore((s) => s.connectArmed);
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const cancelConnect = useCanvasStore((s) => s.cancelConnect);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const extent = boardExtent(elements);

  useEffect(() => {
    surfaceRef.current?.scrollTo?.({ left: 0, top: 0 });
  }, [resetViewNonce]);

  const byId = new Map(elements.map((e) => [e.id, e]));
  const darkSurface = isDarkColor(background);

  return (
    <div className="canvas-stack">
      <main
        id="canvas-board"
        className={`canvas-surface${darkSurface ? " is-dark" : ""}${connectArmed ? " is-connecting" : ""}`}
        ref={surfaceRef}
        tabIndex={-1}
        aria-label="Canvas"
        style={{ backgroundColor: background }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (!isBoardBackground(e.target, surfaceRef.current)) return;
          if (connectArmed) {
            cancelConnect();
            return;
          }
          select(null, "human");
        }}
      >
        <div className="canvas-world" style={extent ? { width: extent.width, height: extent.height } : undefined}>
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
              const labelW = Math.max(32, c.label.length * 7.2 + 16);
              const showLabel = Boolean(c.label) && geo.length >= 44;
              const arrowSelected = selectedId === c.id;
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
                        x={geo.labelX - labelW / 2}
                        y={geo.labelY - 11}
                        width={labelW}
                        height={18}
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
              <p>Or run Find the gap from the agent panel.</p>
            </div>
          ) : null}

          {elements.map((el) => (
            <CanvasElementView key={el.id} element={el} surfaceRef={surfaceRef} />
          ))}
        </div>
      </main>
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

