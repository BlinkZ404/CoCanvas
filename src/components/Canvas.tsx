import { useEffect, useRef } from "react";
import { useCanvasStore } from "../store/canvasStore";
import type { CanvasElement } from "../types";
import { CanvasElementView } from "./CanvasElement";

function center(el: CanvasElement) {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

export function Canvas() {
  const elements = useCanvasStore((s) => s.elements);
  const connectors = useCanvasStore((s) => s.connectors);
  const background = useCanvasStore((s) => s.background);
  const select = useCanvasStore((s) => s.select);
  const resetViewNonce = useCanvasStore((s) => s.resetViewNonce);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // After the canvas is cleared or an agent builds a layout, return the view to
  // the design origin. The structural scroll guard in <App> keeps the fixed
  // frame stable against any browser auto-scroll of freshly rendered elements.
  useEffect(() => {
    surfaceRef.current?.scrollTo({ left: 0, top: 0 });
  }, [resetViewNonce]);

  const byId = new Map(elements.map((e) => [e.id, e]));
  const darkSurface = isDark(background);

  return (
    <main
      className={`canvas-surface${darkSurface ? " is-dark" : ""}`}
      ref={surfaceRef}
      style={{ backgroundColor: background }}
      onMouseDown={(e) => {
        if (e.target === surfaceRef.current) select(null, "human");
      }}
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
            <polygon points="0 0, 10 3.5, 0 7" fill={darkSurface ? "#9aa3b5" : "#6b7280"} />
          </marker>
        </defs>
        {connectors.map((c) => {
          const from = byId.get(c.from);
          const to = byId.get(c.to);
          if (!from || !to) return null;
          const a = center(from);
          const b = center(to);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lift = Math.min(28, Math.hypot(dx, dy) * 0.12);
          const cx = midX;
          const cy = midY - lift;
          const path = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
          return (
            <g key={c.id}>
              <path
                d={path}
                fill="none"
                stroke={darkSurface ? "#8b93a7" : "#7b8494"}
                strokeWidth={1.75}
                markerEnd="url(#arrowhead)"
              />
              {c.label ? (
                <g>
                  <rect
                    x={cx - Math.max(18, c.label.length * 3.6 + 10)}
                    y={cy - 18}
                    width={Math.max(36, c.label.length * 7.2 + 20)}
                    height={16}
                    rx={8}
                    fill={darkSurface ? "#1c1e26" : "#f6f4ef"}
                    stroke={darkSurface ? "#3a3d48" : "#d8d3c8"}
                  />
                  <text x={cx} y={cy - 7} className="connector-label" textAnchor="middle">
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
          <p>Write the job in the brief</p>
          <p>Then run Find the gap, or ask ChatGPT from the compass browser.</p>
        </div>
      ) : null}

      {elements.map((el) => (
        <CanvasElementView key={el.id} element={el} surfaceRef={surfaceRef} />
      ))}
    </main>
  );
}

function isDark(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.42;
}
