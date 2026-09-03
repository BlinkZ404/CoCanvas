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

function area(el: CanvasElement) {
  return Math.max(1, el.width * el.height);
}

function intersection(a: CanvasElement, b: CanvasElement) {
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

  const graphKinds = new Set(["rectangle", "ellipse", "sticky"]);
  const nodes = elements.filter((e) => graphKinds.has(e.kind));
  if (connectors.length > 0 && nodes.length > 0) {
    const degree = new Map<string, { in: number; out: number }>();
    for (const el of nodes) degree.set(el.id, { in: 0, out: 0 });
    for (const c of connectors) {
      if (degree.has(c.from)) degree.get(c.from)!.out += 1;
      if (degree.has(c.to)) degree.get(c.to)!.in += 1;
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
    const starts = nodes.filter((el) => degree.get(el.id)!.in === 0 && degree.get(el.id)!.out > 0);
    const ends = nodes.filter((el) => degree.get(el.id)!.out === 0 && degree.get(el.id)!.in > 0);
    if (starts.length === 0) {
      add("warn", "no_start", "This flow has no start. A node should have outgoing arrows only.", []);
    }
    if (ends.length === 0) {
      add("warn", "no_end", "This flow has no end. A node should have incoming arrows only.", []);
    }
  }

  const unlabeled = elements.filter(
    (e) => (e.kind === "rectangle" || e.kind === "ellipse") && !e.text.trim()
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
      const smaller = Math.min(area(a), area(b));
      if (intersection(a, b) / smaller > 0.4) {
        add("warn", "overlap", `${nodeName(a)} and ${nodeName(b)} overlap. Separate them so the path stays readable.`, [
          a.id,
          b.id,
        ]);
      }
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
