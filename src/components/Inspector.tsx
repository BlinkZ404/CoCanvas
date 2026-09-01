import { useCanvasStore } from "../store/canvasStore";

const BACKGROUNDS = [
  { label: "Paper", value: "#f6f4ef" },
  { label: "Cool", value: "#eef1f6" },
  { label: "Mist", value: "#e8eee9" },
  { label: "Ink", value: "#12141a" },
];

const KIND_LABEL: Record<string, string> = {
  frame: "Frame",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
  sticky: "Sticky",
};

export function Inspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const element = useCanvasStore((s) => s.elements.find((e) => e.id === selectedId) ?? null);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const deleteElement = useCanvasStore((s) => s.deleteElement);
  const background = useCanvasStore((s) => s.background);
  const setBackground = useCanvasStore((s) => s.setBackground);

  if (!element) {
    return (
      <section className="panel inspector">
        <h2>Properties</h2>
        <p className="muted small inspector-empty">Select a shape to edit, or change the background.</p>
        <label className="field">
          <span>Background</span>
          <ColorField
            value={background}
            onChange={(color) => setBackground(color, "human")}
          />
        </label>
        <div className="swatch-row" role="group" aria-label="Background presets">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.value}
              type="button"
              className={`swatch${background.toLowerCase() === bg.value ? " is-active" : ""}`}
              style={{ background: bg.value }}
              title={bg.label}
              aria-label={bg.label}
              onClick={() => setBackground(bg.value, "human")}
            />
          ))}
        </div>
      </section>
    );
  }

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return (
    <section className="panel inspector">
      <div className="inspector-head">
        <h2>{KIND_LABEL[element.kind] ?? element.kind}</h2>
        <span className="mono-tag">{element.id}</span>
      </div>

      {(element.kind === "text" || element.kind === "sticky" || element.kind === "frame") && (
        <label className="field">
          <span>Text</span>
          <input
            type="text"
            value={element.text}
            onChange={(e) => updateElement(element.id, { text: e.target.value }, "human")}
          />
        </label>
      )}

      <h3 className="field-label">Position</h3>
      <div className="field-row">
        <label className="field">
          <span>X</span>
          <input
            type="number"
            value={Math.round(element.x)}
            onChange={(e) => updateElement(element.id, { x: num(e.target.value) }, "human")}
          />
        </label>
        <label className="field">
          <span>Y</span>
          <input
            type="number"
            value={Math.round(element.y)}
            onChange={(e) => updateElement(element.id, { y: num(e.target.value) }, "human")}
          />
        </label>
        <label className="field">
          <span>W</span>
          <input
            type="number"
            value={Math.round(element.width)}
            onChange={(e) => updateElement(element.id, { width: num(e.target.value) }, "human")}
          />
        </label>
        <label className="field">
          <span>H</span>
          <input
            type="number"
            value={Math.round(element.height)}
            onChange={(e) => updateElement(element.id, { height: num(e.target.value) }, "human")}
          />
        </label>
      </div>

      <h3 className="field-label">Appearance</h3>
      <div className="field-row">
        <label className="field">
          <span>{element.kind === "text" ? "Color" : "Fill"}</span>
          <ColorField
            value={element.fill}
            onChange={(fill) => updateElement(element.id, { fill }, "human")}
          />
        </label>
        <label className="field">
          <span>Stroke</span>
          <ColorField
            value={element.stroke}
            onChange={(stroke) => updateElement(element.id, { stroke }, "human")}
          />
        </label>
      </div>

      {(element.kind === "text" || element.kind === "sticky") && (
        <label className="field">
          <span className="field-inline">
            Size
            <span className="field-value">{element.fontSize}px</span>
          </span>
          <input
            type="range"
            min={10}
            max={64}
            value={element.fontSize}
            onChange={(e) => updateElement(element.id, { fontSize: num(e.target.value) }, "human")}
          />
        </label>
      )}

      <SelectedPins elementId={element.id} />

      <button className="btn-ghost-danger" onClick={() => deleteElement(element.id, "human")}>
        Delete
      </button>
    </section>
  );
}

function SelectedPins({ elementId }: { elementId: string }) {
  const pins = useCanvasStore((s) => s.pins.filter((p) => p.elementId === elementId && !p.resolved));
  const resolvePin = useCanvasStore((s) => s.resolvePin);
  if (pins.length === 0) return null;
  return (
    <div className="pin-list">
      <h3 className="field-label">Pins</h3>
      {pins.map((pin) => (
        <div key={pin.id} className="pin-row">
          <p>{pin.text}</p>
          <button type="button" className="pin-resolve" onClick={() => resolvePin(pin.id, "human")}>
            Resolve
          </button>
        </div>
      ))}
    </div>
  );
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = normalizeColor(value);
  return (
    <div className="color-field">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
      <span className="color-hex">{hex}</span>
    </div>
  );
}

function normalizeColor(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : "#000000";
}
