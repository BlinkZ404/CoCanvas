import { useRef, useState } from "react";
import { confirmAction } from "../confirmAction";
import { MIN_NODE_H, MIN_NODE_W } from "../geometry/board";
import { KIND_LABEL, elementName, kindWord } from "../labels";
import { useCanvasStore, type AlignEdge, type LayerAction } from "../store/canvasStore";
import { DARK_BOARD, INK_BOARD, LIGHT_BOARD } from "../theme";
import type { CanvasElement } from "../types";

const BACKGROUNDS = [
  { label: "Paper", value: LIGHT_BOARD },
  { label: "Cool", value: "#eef1f6" },
  { label: "Mist", value: "#e8eee9" },
  { label: "Night", value: DARK_BOARD },
  { label: "Void", value: INK_BOARD },
];

const LAYER_ACTIONS: { action: LayerAction; label: string }[] = [
  { action: "front", label: "Front" },
  { action: "forward", label: "Forward" },
  { action: "backward", label: "Backward" },
  { action: "back", label: "Back" },
];

const ALIGN_EDGES: { edge: AlignEdge; label: string }[] = [
  { edge: "left", label: "Left" },
  { edge: "center", label: "Center" },
  { edge: "right", label: "Right" },
  { edge: "top", label: "Top" },
  { edge: "middle", label: "Middle" },
  { edge: "bottom", label: "Bottom" },
];

export function Inspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectedIds = useCanvasStore((s) => s.selectedIds ?? []);
  const selectedNodes = useCanvasStore((s) => s.elements.filter((e) => (s.selectedIds ?? []).includes(e.id)));
  const element = useCanvasStore((s) => s.elements.find((e) => e.id === selectedId) ?? null);
  const connector = useCanvasStore((s) => s.connectors.find((c) => c.id === selectedId) ?? null);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const deleteElement = useCanvasStore((s) => s.deleteElement);
  const deleteElements = useCanvasStore((s) => s.deleteElements);
  const layerElement = useCanvasStore((s) => s.layerElement);
  const duplicateElement = useCanvasStore((s) => s.duplicateElement);
  const alignElement = useCanvasStore((s) => s.alignElement);
  const updateConnector = useCanvasStore((s) => s.updateConnector);
  const reverseConnector = useCanvasStore((s) => s.reverseConnector);
  const deleteConnector = useCanvasStore((s) => s.deleteConnector);
  const background = useCanvasStore((s) => s.background);
  const setBackground = useCanvasStore((s) => s.setBackground);

  const fromEl = useCanvasStore((s) => s.elements.find((e) => e.id === connector?.from) ?? null);
  const toEl = useCanvasStore((s) => s.elements.find((e) => e.id === connector?.to) ?? null);
  const fieldStart = useRef("");
  const layerRank = useCanvasStore((s) => {
    if (!element) return { index: 0, total: s.elements.length };
    const ordered = [...s.elements].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
    return { index: ordered.findIndex((e) => e.id === element.id) + 1, total: ordered.length };
  });

  const panelClass =
    selectedNodes.length > 0 || element || connector ? "panel inspector" : "panel inspector is-empty";

  if (selectedNodes.length > 1) {
    return (
      <section id="inspector-panel" className={panelClass}>
        <div className="inspector-head">
          <h2>{selectedNodes.length} selected</h2>
        </div>
        <p className="muted small inspector-empty">
          Drag to move them together. Shift-click to add or remove. Ctrl or Cmd+A selects all.
        </p>
        <button
          className="btn-ghost-danger"
          onClick={async () => {
            const yes = await confirmAction({
              title: "Delete these nodes?",
              body: `Delete ${selectedNodes.length} nodes and any arrows or pins on them.`,
              confirmLabel: "Delete",
            });
            if (yes) deleteElements(selectedIds, "human");
          }}
        >
          Delete
        </button>
      </section>
    );
  }

  if (connector && !element) {
    return (
      <section id="inspector-panel" className={panelClass}>
        <div className="inspector-head">
          <h2>Connector</h2>
        </div>
        <label className="field">
          <span>Label</span>
          <input
            type="text"
            value={connector.label}
            onFocus={() => {
              fieldStart.current = connector.label;
              useCanvasStore.getState().beginGesture();
            }}
            onChange={(e) => updateConnector(connector.id, { label: e.target.value }, "human", { log: false })}
            onBlur={(e) => {
              if (e.target.value !== fieldStart.current) {
                useCanvasStore.getState().log("human", "updated a connector");
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
        <p className="muted small">
          {nodeLabel(fromEl)} to {nodeLabel(toEl)}
        </p>
        <button
          type="button"
          className="arrange-btn"
          onClick={() => reverseConnector(connector.id, "human")}
        >
          Reverse arrow
        </button>
        <button
          className="btn-ghost-danger"
          onClick={async () => {
            const yes = await confirmAction({
              title: "Delete this connector?",
              body: "Remove this arrow from the board.",
              confirmLabel: "Delete",
            });
            if (yes) deleteConnector(connector.id, "human");
          }}
        >
          Delete
        </button>
      </section>
    );
  }

  if (!element) {
    return (
      <section id="inspector-panel" className={panelClass}>
        <h2>Properties</h2>
        <p className="muted small inspector-empty">Select a shape to edit.</p>
        <label className="field">
          <span>Background</span>
          <ColorField
            label="Background"
            value={background}
            onChange={(color) => setBackground(color, "human")}
          />
        </label>
        <div className="swatch-row" role="group" aria-label="Background presets">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.value}
              type="button"
              className={`swatch${background.trim().toLowerCase() === bg.value.toLowerCase() ? " is-active" : ""}`}
              style={{ background: bg.value }}
              title={bg.label}
              aria-label={bg.label}
              aria-pressed={background.trim().toLowerCase() === bg.value.toLowerCase()}
              onClick={() => setBackground(bg.value, "human")}
            />
          ))}
        </div>
      </section>
    );
  }

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const pos = (v: string) => Math.max(0, num(v));
  const sizeW = (v: string) => Math.max(MIN_NODE_W, num(v));
  const sizeH = (v: string) => Math.max(MIN_NODE_H, num(v));

  return (
    <section id="inspector-panel" className={panelClass}>
      <div className="inspector-head">
        <h2>{KIND_LABEL[element.kind]}</h2>
      </div>

      <label className="field">
        <span>Label</span>
        <textarea
          rows={3}
          value={element.text}
          onFocus={() => {
            fieldStart.current = element.text;
            useCanvasStore.getState().beginGesture();
          }}
          onChange={(e) => updateElement(element.id, { text: e.target.value }, "human", { log: false })}
          onBlur={(e) => {
            if (e.target.value !== fieldStart.current) {
              useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
            }
            useCanvasStore.getState().endGesture();
          }}
        />
      </label>

      <h3 className="field-label">Position</h3>
      <div className="field-row">
        <label className="field">
          <span>X</span>
          <input
            type="number"
            min={0}
            value={Math.round(element.x)}
            onFocus={() => {
              fieldStart.current = String(Math.round(element.x));
              useCanvasStore.getState().beginGesture();
            }}
            onChange={(e) => updateElement(element.id, { x: pos(e.target.value) }, "human", { log: false })}
            onBlur={(e) => {
              if (e.target.value !== fieldStart.current) {
                useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
        <label className="field">
          <span>Y</span>
          <input
            type="number"
            min={0}
            value={Math.round(element.y)}
            onFocus={() => {
              fieldStart.current = String(Math.round(element.y));
              useCanvasStore.getState().beginGesture();
            }}
            onChange={(e) => updateElement(element.id, { y: pos(e.target.value) }, "human", { log: false })}
            onBlur={(e) => {
              if (e.target.value !== fieldStart.current) {
                useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
        <label className="field">
          <span>W</span>
          <input
            type="number"
            min={MIN_NODE_W}
            value={Math.round(element.width)}
            onFocus={() => {
              fieldStart.current = String(Math.round(element.width));
              useCanvasStore.getState().beginGesture();
            }}
            onChange={(e) => updateElement(element.id, { width: sizeW(e.target.value) }, "human", { log: false })}
            onBlur={(e) => {
              if (String(sizeW(e.target.value)) !== fieldStart.current) {
                useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
        <label className="field">
          <span>H</span>
          <input
            type="number"
            min={MIN_NODE_H}
            value={Math.round(element.height)}
            onFocus={() => {
              fieldStart.current = String(Math.round(element.height));
              useCanvasStore.getState().beginGesture();
            }}
            onChange={(e) => updateElement(element.id, { height: sizeH(e.target.value) }, "human", { log: false })}
            onBlur={(e) => {
              if (String(sizeH(e.target.value)) !== fieldStart.current) {
                useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
      </div>

      <h3 className="field-label">Appearance</h3>
      <div className="field-row">
        <label className="field">
          <span>{element.kind === "text" ? "Color" : "Fill"}</span>
          <ColorField
            label={element.kind === "text" ? "Color" : "Fill"}
            value={element.fill}
            onChange={(fill) => updateElement(element.id, { fill }, "human", { log: false })}
            onGestureStart={() => {
              fieldStart.current = element.fill;
              useCanvasStore.getState().beginGesture();
            }}
            onGestureEnd={(value) => {
              if (value !== fieldStart.current) {
                useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
        <label className="field">
          <span>Stroke</span>
          <ColorField
            label="Stroke"
            value={element.stroke}
            onChange={(stroke) => updateElement(element.id, { stroke }, "human", { log: false })}
            onGestureStart={() => {
              fieldStart.current = element.stroke;
              useCanvasStore.getState().beginGesture();
            }}
            onGestureEnd={(value) => {
              if (value !== fieldStart.current) {
                useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
              }
              useCanvasStore.getState().endGesture();
            }}
          />
        </label>
      </div>

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
          onPointerDown={() => {
            fieldStart.current = String(element.fontSize);
            useCanvasStore.getState().beginGesture();
          }}
          onChange={(e) => updateElement(element.id, { fontSize: num(e.target.value) }, "human", { log: false })}
          onPointerUp={(e) => {
            if (e.currentTarget.value !== fieldStart.current) {
              useCanvasStore.getState().log("human", `updated ${elementName(element)}`);
            }
            useCanvasStore.getState().endGesture();
          }}
        />
      </label>

      <h3 className="field-label">
        <span>Arrange</span>
        <span className="field-value">Layer {layerRank.index} of {layerRank.total}</span>
      </h3>
      <div className="arrange-row">
        {LAYER_ACTIONS.map((item) => (
          <button
            key={item.action}
            type="button"
            className="arrange-btn"
            onClick={() => layerElement(element.id, item.action, "human")}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="arrange-row arrange-row-single">
        <button
          type="button"
          className="arrange-btn"
          onClick={() => duplicateElement(element.id, "human")}
        >
          Duplicate
        </button>
      </div>

      <h3 className="field-label">Align</h3>
      <p className="muted small align-hint">
        Aligns inside the parent frame, or to the page if it is free on the board.
      </p>
      <div className="arrange-row arrange-row-3">
        {ALIGN_EDGES.map((item) => (
          <button
            key={item.edge}
            type="button"
            className="arrange-btn"
            onClick={() => alignElement(element.id, item.edge, "human")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <PinComposer elementId={element.id} />
      <SelectedPins elementId={element.id} />

      <button
        className="btn-ghost-danger"
        onClick={async () => {
          const yes = await confirmAction({
            title: "Delete this node?",
            body: `Delete ${KIND_LABEL[element.kind]} and any arrows or pins on it.`,
            confirmLabel: "Delete",
          });
          if (yes) deleteElement(element.id, "human");
        }}
      >
        Delete
      </button>
    </section>
  );
}

function PinComposer({ elementId }: { elementId: string }) {
  const [note, setNote] = useState("");
  const addPin = useCanvasStore((s) => s.addPin);

  return (
    <form
      className="pin-composer"
      onSubmit={(e) => {
        e.preventDefault();
        const text = note.trim();
        if (!text) return;
        addPin(elementId, text, "human");
        setNote("");
      }}
    >
      <label className="field">
        <span>Pin a note</span>
        <input
          type="text"
          value={note}
          placeholder="What is missing or wrong"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button type="submit" className="btn-pin" disabled={!note.trim()}>
        Pin this node
      </button>
    </form>
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

function ColorField({
  value,
  onChange,
  label,
  onGestureStart,
  onGestureEnd,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  onGestureStart?: () => void;
  onGestureEnd?: (value: string) => void;
}) {
  const hex = normalizeColor(value);
  return (
    <div className="color-field">
      <input
        type="color"
        value={hex}
        aria-label={label}
        onPointerDown={onGestureStart}
        onChange={(e) => onChange(e.target.value)}
        onPointerUp={(e) => onGestureEnd?.(e.currentTarget.value)}
      />
      <span className="color-hex" aria-hidden>
        {hex}
      </span>
    </div>
  );
}

function normalizeColor(c: string): string {
  const s = c.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return s.slice(0, 7).toLowerCase();
  return "#000000";
}

function nodeLabel(el: Pick<CanvasElement, "kind" | "text"> | null): string {
  if (!el) return "a node";
  const text = el.text.trim();
  return text || kindWord(el.kind);
}
