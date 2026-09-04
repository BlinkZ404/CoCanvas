import { isDecorShape, rectangleRole } from "../design";
import { connectorLabelBox, connectorLayout } from "../geometry/connectors";
import { KIND_LABEL, clipLabel } from "../labels";
import type { CanvasElement, Connector, Pin } from "../types";

export type FindingSeverity = "error" | "warn" | "info";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  code: string;
  message: string;
  elementIds: string[];
}

export interface ReviewInput {
  brief: string;
  elements: CanvasElement[];
  connectors: Connector[];
  pins: Pin[];
}

export interface ReviewReport {
  summary: string;
  brief: string;
  briefTerms: string[];
  coveredTerms: string[];
  missingTerms: string[];
  findings: Finding[];
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "with",
  "your",
  "our",
  "every",
  "step",
  "steps",
  "labeled",
  "one",
  "path",
  "through",
  "then",
  "into",
  "from",
  "must",
  "should",
  "please",
  "app",
  "user",
  "users",
  "each",
  "all",
  "this",
  "that",
  "flow",
]);

export function briefTerms(brief: string): string[] {
  const parts = brief
    .split(/[,/;|]|\band\b|\bthen\b|[.:]/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const terms: string[] = [];
  for (const part of parts) {
    const words = part.split(/\s+/).filter((w) => {
      const n = w.toLowerCase().replace(/[^a-z0-9-]/g, "");
      return n.length >= 3 && !STOP.has(n);
    });
    if (words.length === 0) continue;
    if (words.length <= 4) terms.push(words.join(" "));
    else {
      for (const w of words) {
        if (w.replace(/[^a-z0-9-]/gi, "").length >= 5) terms.push(w);
      }
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of terms) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  return unique;
}

type Box = { x: number; y: number; width: number; height: number };

function area(el: Box) {
  return Math.max(1, el.width * el.height);
}

function intersection(a: Box, b: Box) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function contains(outer: CanvasElement, inner: CanvasElement) {
  return (
    inner.x >= outer.x - 4 &&
    inner.y >= outer.y - 4 &&
    inner.x + inner.width <= outer.x + outer.width + 4 &&
    inner.y + inner.height <= outer.y + outer.height + 4
  );
}

function nodeName(el: CanvasElement) {
  const text = el.text.trim();
  return text ? clipLabel(text) : KIND_LABEL[el.kind];
}

const GRAPH_KINDS = new Set(["rectangle", "ellipse", "sticky"]);

export function isGraphNode(el: CanvasElement): boolean {
  return GRAPH_KINDS.has(el.kind) && !isDecorShape(el);
}

export function isNonConnectable(el: CanvasElement): boolean {
  return el.kind === "text" || el.kind === "frame" || isDecorShape(el);
}

export function sameBand(a: CanvasElement, b: CanvasElement): boolean {
  const ay = a.y + a.height / 2;
  const by = b.y + b.height / 2;
  return Math.abs(ay - by) <= Math.max(24, Math.min(a.height, b.height) * 0.55);
}

function linked(connectors: Connector[], a: string, b: string): boolean {
  return connectors.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));
}

export function sharedHubAbove(
  from: CanvasElement,
  to: CanvasElement,
  elements: CanvasElement[],
  connectors: Connector[]
): boolean {
  const top = Math.min(from.y, to.y);
  return elements.some((hub) => {
    if (hub.id === from.id || hub.id === to.id) return false;
    if (!isGraphNode(hub)) return false;
    if (hub.y + hub.height > top - 8) return false;
    return linked(connectors, hub.id, from.id) && linked(connectors, hub.id, to.id);
  });
}

export function blockedConnectorReason(
  from: CanvasElement,
  to: CanvasElement,
  elements: CanvasElement[],
  connectors: Connector[]
): string | null {
  if (isNonConnectable(from) || isNonConnectable(to)) {
    return "do not connect a score bar, score label, or free text. Arrows go between topic nodes only.";
  }
  if (sameBand(from, to) && sharedHubAbove(from, to, elements, connectors)) {
    return "those two already hang from the hub. Do not add a side arrow. It will look like it goes through the box.";
  }
  return null;
}

function canvasText(elements: CanvasElement[], connectors: Connector[]) {
  return [
    ...elements.map((e) => e.text),
    ...connectors.map((c) => c.label),
  ]
    .join(" ")
    .toLowerCase();
}

export function reviewCanvas(input: ReviewInput): ReviewReport {
  const { brief, elements, connectors, pins } = input;
  const terms = briefTerms(brief);
  const hay = canvasText(elements, connectors);
  const covered: string[] = [];
  const missing: string[] = [];
  for (const term of terms) {
    if (hay.includes(term.toLowerCase())) covered.push(term);
    else missing.push(term);
  }

  const byId = new Map(elements.map((el) => [el.id, el]));
  const findings: Finding[] = [];
  let n = 0;
  const add = (severity: FindingSeverity, code: string, message: string, elementIds: string[]) => {
    n += 1;
    findings.push({ id: `f_${n}`, severity, code, message, elementIds });
  };

  if (elements.length === 0) {
    add("info", "empty", "The canvas is empty. Draft from the brief, or add a shape.", []);
  }

  if (!brief.trim()) {
    add(
      "warn",
      "no_brief",
      "No brief is set. Write the job on the board so the agent can check its work against it.",
      []
    );
  }

  for (const term of missing) {
    add(
      "error",
      "brief_gap",
      `The brief asks for "${term}", but nothing on the board mentions it.`,
      []
    );
  }

  const nodes = elements.filter(isGraphNode);
  if (connectors.length > 0 && nodes.length > 0) {
    const degree = new Map<string, { in: number; out: number }>();
    for (const el of nodes) degree.set(el.id, { in: 0, out: 0 });
    for (const c of connectors) {
      const fromDeg = degree.get(c.from);
      const toDeg = degree.get(c.to);
      if (fromDeg) fromDeg.out += 1;
      if (toDeg) toDeg.in += 1;
    }
    const orphans = nodes.filter((el) => {
      const d = degree.get(el.id);
      return d && d.in === 0 && d.out === 0;
    });
    if (orphans.length) {
      add(
        "warn",
        "orphan",
        `${orphans.length} node${orphans.length === 1 ? "" : "s"} sit off the path. Connect or remove them.`,
        orphans.map((e) => e.id)
      );
    }
    const starts = nodes.filter((el) => {
      const d = degree.get(el.id);
      return Boolean(d && d.in === 0 && d.out > 0);
    });
    const ends = nodes.filter((el) => {
      const d = degree.get(el.id);
      return Boolean(d && d.out === 0 && d.in > 0);
    });
    if (starts.length === 0) {
      add("warn", "no_start", "This flow has no start. A node should have outgoing arrows only.", []);
    }
    if (ends.length === 0) {
      add("warn", "no_end", "This flow has no end. A node should have incoming arrows only.", []);
    }
    for (const el of nodes) {
      const out = degree.get(el.id)?.out ?? 0;
      if (out < 3) continue;
      const pancake = el.width >= 480 || el.width / Math.max(1, el.height) > 4;
      if (!pancake) continue;
      const below = nodes.filter(
        (child) => child.id !== el.id && child.y >= el.y + el.height - 8 && linked(connectors, el.id, child.id)
      );
      if (below.length < 3) continue;
      add(
        "warn",
        "wide_hub",
        "This hub is stretched so the arrows stay vertical. Shrink it to about 320 by 100. The page bends arrows from a compact hub.",
        [el.id]
      );
    }
  }

  const screenMock = /(log ?in|sign ?in|welcome back|email address|continue with|password)/i.test(
    `${brief} ${elements.map((e) => e.text).join(" ")}`
  );
  if (!screenMock && elements.length >= 3 && connectors.length === 0) {
    add(
      "warn",
      "no_diagram",
      "This board is type, not a diagram. Add nodes and connect_elements so it reads as a map.",
      []
    );
  }

  const unlabeled = elements.filter(
    (e) => (e.kind === "rectangle" || e.kind === "ellipse") && !e.text.trim() && !isDecorShape(e)
  );
  if (unlabeled.length) {
    add(
      "warn",
      "unlabeled",
      `${unlabeled.length} shape${unlabeled.length === 1 ? " has" : "s have"} no label. Name the step so the agent and human share a reference.`,
      unlabeled.map((e) => e.id)
    );
  }

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      if (a.kind === "frame" && contains(a, b)) continue;
      if (b.kind === "frame" && contains(b, a)) continue;
      const hit = intersection(a, b);
      if (hit <= 12) continue;
      const smaller = Math.min(area(a), area(b));
      const textPair = a.kind === "text" || b.kind === "text";
      if (textPair || hit / smaller > 0.2) {
        add("warn", "overlap", `${nodeName(a)} and ${nodeName(b)} overlap. Separate them so the path stays readable.`, [
          a.id,
          b.id,
        ]);
      }
    }
  }

  for (const c of connectors) {
    const from = byId.get(c.from);
    const to = byId.get(c.to);
    if (!from || !to) continue;
    const blocked = blockedConnectorReason(from, to, elements, connectors);
    if (blocked) {
      if (isNonConnectable(from) || isNonConnectable(to)) {
        add(
          "warn",
          "score_link",
          "Do not connect score bars, score labels, or numbers. Cited scores are a list. Delete this arrow.",
          [from.id, to.id]
        );
      } else {
        add(
          "warn",
          "side_link",
          "On a product map, only the hub should connect to these nodes. A side arrow looks like it goes through the box. Delete it.",
          [from.id, to.id]
        );
      }
    }
    if (!c.label.trim()) continue;
    const box = connectorLabelBox(c.label, connectorLayout(from, to));
    for (const el of elements) {
      if (el.id === c.from || el.id === c.to) continue;
      if (el.kind === "frame" || rectangleRole(el) === "rule") continue;
      if (intersection(el, box) <= 12) continue;
      add(
        "warn",
        "overlap",
        `${nodeName(el)} sits on the "${clipLabel(c.label)}" arrow. Move that type onto a node.`,
        [el.id]
      );
    }
  }

  const openPins = pins.filter((p) => !p.resolved);
  if (openPins.length) {
    add(
      "info",
      "open_pins",
      `${openPins.length} open pin${openPins.length === 1 ? "" : "s"} still need a human or agent to resolve.`,
      openPins.map((p) => p.elementId)
    );
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const summary =
    errors === 0 && warns === 0
      ? covered.length
        ? `The board covers the brief (${covered.length} term${covered.length === 1 ? "" : "s"}). No blocking issues.`
        : "No blocking issues. Add a brief if you want the page to check the job."
      : `${errors} gap${errors === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}.`;

  return { summary, brief, briefTerms: terms, coveredTerms: covered, missingTerms: missing, findings };
}
