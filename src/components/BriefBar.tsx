import { useCanvasStore } from "../store/canvasStore";

export function BriefBar() {
  const brief = useCanvasStore((s) => s.brief);
  const setBrief = useCanvasStore((s) => s.setBrief);

  return (
    <div className="brief-bar">
      <label className="brief-label" htmlFor="canvas-brief">
        Brief
      </label>
      <input
        id="canvas-brief"
        type="text"
        value={brief}
        placeholder="The job on this board. Example: grocery checkout with cart, address, payment, success."
        onChange={(e) => setBrief(e.target.value, "human")}
      />
    </div>
  );
}
