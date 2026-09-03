import { useRef } from "react";
import { useCanvasStore } from "../store/canvasStore";

export function BriefBar() {
  const brief = useCanvasStore((s) => s.brief);
  const setBrief = useCanvasStore((s) => s.setBrief);
  const started = useRef(brief);

  return (
    <div className="brief-bar">
      <label className="brief-label" htmlFor="canvas-brief">
        Brief
      </label>
      <input
        id="canvas-brief"
        type="text"
        value={brief}
        placeholder="Grocery checkout with cart, address, payment, success"
        onFocus={() => {
          started.current = useCanvasStore.getState().brief;
          useCanvasStore.getState().beginGesture();
        }}
        onChange={(e) => setBrief(e.target.value, "human", { log: false, undo: false })}
        onBlur={() => {
          const current = useCanvasStore.getState().brief;
          if (current !== started.current) {
            useCanvasStore.getState().log("human", current.trim() ? "updated the brief" : "cleared the brief");
          }
          useCanvasStore.getState().endGesture();
        }}
      />
    </div>
  );
}
