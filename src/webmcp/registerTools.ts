import { useCanvasStore } from "../store/canvasStore";
import type { CanvasElement, ElementKind } from "../types";
import {
  ensureModelContext,
  resultToText,
  type ModelContextLike,
  type ToolDefinition,
} from "./polyfill";

const KINDS: ElementKind[] = ["frame", "rectangle", "ellipse", "text", "sticky"];

function store() {
  return useCanvasStore.getState();
}

function describe(el: CanvasElement) {
  return {
    id: el.id,
    kind: el.kind,
    x: Math.round(el.x),
    y: Math.round(el.y),
    width: Math.round(el.width),
    height: Math.round(el.height),
    text: el.text,
    fill: el.fill,
    stroke: el.stroke,
    fontSize: el.fontSize,
  };
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * The full WebMCP tool surface for CoCanvas. Every tool mutates or reads the same
 * shared canvas store that the human UI uses, so people and agents collaborate
 * on one live document. All agent-driven actions are tagged actor: "agent" so
 * they appear attributed in the activity feed.
 */
function toolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "get_canvas_summary",
      description:
        "Get a high-level summary of the CoCanvas design: element counts by type, the background color, connectors, and the id of the currently selected element. Call this first to understand the current design before making changes.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        const s = store();
        const counts: Record<string, number> = {};
        for (const e of s.elements) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
        return ok(
          JSON.stringify(
            {
              totalElements: s.elements.length,
              countsByKind: counts,
              connectors: s.connectors.length,
              background: s.background,
              selectedId: s.selectedId,
            },
            null,
            2
          )
        );
      },
    },
    {
      name: "list_elements",
      description:
        "List every element currently on the canvas with its id, kind, position, size, text, and colors. Use this to find the id of an element you want to update, move, connect, or delete.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: KINDS,
            description: "Optional filter to only return elements of this kind.",
          },
        },
      },
      execute: (input: { kind?: ElementKind }) => {
        let els = store().elements;
        if (input?.kind) els = els.filter((e) => e.kind === input.kind);
        return ok(JSON.stringify(els.map(describe), null, 2));
      },
    },
    {
      name: "add_element",
      description:
        "Add one element to the canvas: 'frame' (artboard/container), 'rectangle' or 'ellipse' (shapes), 'text' (heading/label), or 'sticky' (sticky note). Returns the created element with its new id. Any omitted field uses a sensible default. The canvas is a fixed frame, so keep x roughly 0 to 560 and y roughly 0 to 440 to keep elements in view.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS, description: "The type of element to add." },
          x: { type: "number", description: "Left position in canvas pixels." },
          y: { type: "number", description: "Top position in canvas pixels." },
          width: { type: "number", description: "Width in pixels." },
          height: { type: "number", description: "Height in pixels." },
          text: { type: "string", description: "Text content (for text, sticky, frame title)." },
          fill: { type: "string", description: "Fill color as a hex string, e.g. #6366f1." },
          stroke: { type: "string", description: "Border color as a hex string." },
          fontSize: { type: "number", description: "Font size in pixels." },
        },
        required: ["kind"],
      },
      execute: (input: Partial<CanvasElement> & { kind: ElementKind }) => {
        if (!KINDS.includes(input.kind)) {
          return ok(`Error: kind must be one of ${KINDS.join(", ")}`);
        }
        const el = store().addElement(input, "agent");
        return ok(`Added element:\n${JSON.stringify(describe(el), null, 2)}`);
      },
    },
    {
      name: "update_element",
      description:
        "Update properties of an existing element by id. Provide only the fields you want to change (text, fill, stroke, fontSize, x, y, width, height). Use list_elements first to find the id.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The id of the element to update." },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          text: { type: "string" },
          fill: { type: "string", description: "Hex color." },
          stroke: { type: "string", description: "Hex color." },
          fontSize: { type: "number" },
        },
        required: ["id"],
      },
      execute: (input: { id: string } & Partial<CanvasElement>) => {
        const { id, ...patch } = input;
        const updated = store().updateElement(id, patch, "agent");
        if (!updated) return ok(`Error: no element with id "${id}"`);
        return ok(`Updated:\n${JSON.stringify(describe(updated), null, 2)}`);
      },
    },
    {
      name: "move_element",
      description:
        "Move an element to an absolute position (x, y) in canvas pixels. Use list_elements to find ids and current positions. Keep x roughly 0 to 560 and y roughly 0 to 440 so the element stays within the visible frame.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["id", "x", "y"],
      },
      execute: (input: { id: string; x: number; y: number }) => {
        const moved = store().moveElement(input.id, input.x, input.y, "agent");
        if (!moved) return ok(`Error: no element with id "${input.id}"`);
        return ok(`Moved ${input.id} to (${Math.round(input.x)}, ${Math.round(input.y)}).`);
      },
    },
    {
      name: "delete_element",
      description: "Delete an element from the canvas by id, along with any connectors attached to it.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: (input: { id: string }) => {
        const removed = store().deleteElement(input.id, "agent");
        return ok(removed ? `Deleted ${input.id}.` : `Error: no element with id "${input.id}"`);
      },
    },
    {
      name: "select_element",
      description:
        "Select and highlight an element so the human collaborator can see which element you are referring to. Pass null or omit id to clear the selection.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Element id, or omit to clear." } },
      },
      execute: (input: { id?: string | null }) => {
        const id = input?.id ?? null;
        if (id && !store().elements.some((e) => e.id === id)) {
          return ok(`Error: no element with id "${id}"`);
        }
        store().select(id, "agent");
        return ok(id ? `Selected ${id}.` : "Cleared selection.");
      },
    },
    {
      name: "connect_elements",
      description:
        "Draw a labeled connector/arrow from one element to another. Great for flowcharts and diagrams. Both ids must exist.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source element id." },
          to: { type: "string", description: "Target element id." },
          label: { type: "string", description: "Optional label shown on the connector." },
        },
        required: ["from", "to"],
      },
      execute: (input: { from: string; to: string; label?: string }) => {
        const conn = store().connect(input.from, input.to, input.label ?? "", "agent");
        if (!conn) return ok(`Error: one or both ids do not exist (${input.from}, ${input.to}).`);
        return ok(`Connected ${input.from} → ${input.to}.`);
      },
    },
    {
      name: "arrange_grid",
      description:
        "Auto-arrange all elements on the canvas into a tidy grid with the given number of columns. Useful for cleaning up a messy layout.",
      inputSchema: {
        type: "object",
        properties: {
          columns: { type: "number", description: "Number of columns (default 3)." },
        },
      },
      execute: (input: { columns?: number }) => {
        const n = store().arrangeGrid(input?.columns ?? 3, "agent");
        return ok(`Arranged ${n} elements into ${input?.columns ?? 3} columns.`);
      },
    },
    {
      name: "set_background",
      description: "Set the canvas background color (hex string, e.g. #0f172a for dark).",
      inputSchema: {
        type: "object",
        properties: { color: { type: "string", description: "Hex color string." } },
        required: ["color"],
      },
      execute: (input: { color: string }) => {
        store().setBackground(input.color, "agent");
        return ok(`Background set to ${input.color}.`);
      },
    },
    {
      name: "clear_canvas",
      description:
        "Remove all elements and connectors from the canvas to start fresh. Use with care; this cannot be undone.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        store().clearAll("agent");
        return ok("Canvas cleared.");
      },
    },
    {
      name: "create_layout",
      description:
        "Compose a complete starter layout from primitives in one call. Supported templates: 'login' (a login screen mockup), 'kanban' (a three-column board), and 'flowchart' (a simple connected flow). This demonstrates building a coherent multi-element design in a single agent action.",
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            enum: ["login", "kanban", "flowchart"],
            description: "Which starter layout to build.",
          },
        },
        required: ["template"],
      },
      execute: (input: { template: "login" | "kanban" | "flowchart" }) => {
        const s = store();
        s.resetView();
        let message: string;
        switch (input.template) {
          case "login": {
            s.setBackground("#12141a", "agent");
            s.addElement(
              { kind: "frame", x: 40, y: 48, width: 300, height: 400, text: "Sign in", fill: "#fffcf7", stroke: "#d8d3c8" },
              "agent"
            );
            s.addElement({ kind: "text", x: 68, y: 92, width: 244, height: 32, text: "Welcome back", fill: "#1a1a1e", fontSize: 22 }, "agent");
            s.addElement({ kind: "rectangle", x: 68, y: 162, width: 244, height: 42, text: "Email", fill: "#f3efe6", stroke: "#d8d3c8", fontSize: 14 }, "agent");
            s.addElement({ kind: "rectangle", x: 68, y: 216, width: 244, height: 42, text: "Password", fill: "#f3efe6", stroke: "#d8d3c8", fontSize: 14 }, "agent");
            s.addElement({ kind: "rectangle", x: 68, y: 286, width: 244, height: 46, text: "Continue", fill: "#6d74c9", stroke: "#4f5699", fontSize: 15 }, "agent");
            s.addElement({ kind: "text", x: 96, y: 354, width: 190, height: 24, text: "Forgot password?", fill: "#6d74c9", fontSize: 13 }, "agent");
            message = "Built a login screen mockup inside a frame.";
            break;
          }
          case "kanban": {
            const cols = [
              { title: "To do", fill: "#f3e4c6", stroke: "#d4b57a" },
              { title: "In progress", fill: "#d7e0f0", stroke: "#9aa8c4" },
              { title: "Done", fill: "#d7e6d8", stroke: "#8fad93" },
            ];
            cols.forEach((col, i) => {
              const fx = 20 + i * 170;
              s.addElement({ kind: "frame", x: fx, y: 48, width: 156, height: 392, text: col.title, fill: "#fffcf7", stroke: "#d8d3c8" }, "agent");
              s.addElement({ kind: "sticky", x: fx + 14, y: 100, width: 128, height: 86, text: `${col.title} card`, fill: col.fill, stroke: col.stroke, fontSize: 13 }, "agent");
            });
            message = "Built a three-column kanban board.";
            break;
          }
          case "flowchart": {
            s.setBackground("#f6f4ef", "agent");
            s.addElement({ kind: "text", x: 24, y: 40, width: 280, height: 28, text: "User journey", fill: "#1a1a1e", fontSize: 20 }, "agent");
            const a = s.addElement({ kind: "ellipse", x: 24, y: 132, width: 108, height: 80, text: "Start", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 15 }, "agent");
            const b = s.addElement({ kind: "rectangle", x: 176, y: 140, width: 124, height: 64, text: "Process", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 15 }, "agent");
            const c = s.addElement({ kind: "ellipse", x: 344, y: 132, width: 108, height: 80, text: "End", fill: "#c46b5d", stroke: "#9a5248", fontSize: 15 }, "agent");
            s.connect(a.id, b.id, "next", "agent");
            s.connect(b.id, c.id, "done", "agent");
            message = "Built a start → process → end flowchart with connectors.";
            break;
          }
          default:
            return ok("Error: unknown template.");
        }
        // Clear the selection so the browser has no freshly selected element to
        // auto-scroll into view, keeping the whole layout in the fixed frame.
        s.select(null, "agent");
        return ok(message);
      },
    },
  ];
}

let registered = false;

export interface RegistrationInfo {
  modelContext: ModelContextLike;
  polyfilled: boolean;
  toolNames: string[];
}

/** Registers the CoCanvas WebMCP tool surface exactly once. */
export function registerCoCanvasTools(): RegistrationInfo {
  const { modelContext, polyfilled } = ensureModelContext();
  const defs = toolDefinitions();

  if (!registered) {
    for (const def of defs) {
      modelContext.registerTool(def);
    }
    registered = true;
  }

  return {
    modelContext,
    polyfilled,
    toolNames: defs.map((d) => d.name),
  };
}

export { resultToText };
