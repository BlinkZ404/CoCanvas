import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCanvasStore } from "../store/canvasStore";
import type { Finding, ReviewReport } from "../review/reviewCanvas";
import { popConfirmBypass, pushConfirmBypass } from "../confirmAction";
import { SAMPLE_BRIEF } from "../webmcp/registerTools";
import { resultToText, type ModelContextLike, type RegisteredTool } from "../webmcp/polyfill";
import { CHATGPT_PROMPT } from "../guide";
import { LIGHT_BOARD } from "../theme";
import { IconFlow, IconGap, IconKanban, IconLayout, IconNote, IconReview } from "./Icons";

interface Props {
  modelContext: ModelContextLike | null;
}

interface CallLine {
  id: number;
  tool: string;
  args: string;
  result: string;
  error?: boolean;
}

interface Step {
  tool: string;
  args?: Record<string, unknown>;
  saveAs?: string;
  from?: (saved: Record<string, string>) => Record<string, unknown>;
}

const AGENT_TASKS: { label: string; hint: string; icon: ReactNode; steps: Step[] }[] = [
  {
    label: "Find the gap",
    hint: "Brief, draft, review, pin",
    icon: <IconGap size={18} />,
    steps: [
      { tool: "set_brief", args: { brief: SAMPLE_BRIEF } },
      { tool: "clear_canvas" },
      {
        tool: "add_element",
        args: { kind: "text", x: 40, y: 32, width: 520, height: 32, text: "Grocery checkout", fill: "#1a1a1e", fontSize: 22 },
      },
      {
        tool: "add_element",
        saveAs: "cart",
        args: { kind: "ellipse", x: 40, y: 128, width: 148, height: 80, text: "Cart review", fill: "#5a9e86", stroke: "#3f7a66", fontSize: 14 },
      },
      {
        tool: "add_element",
        saveAs: "addr",
        args: { kind: "rectangle", x: 252, y: 136, width: 176, height: 68, text: "Delivery address", fill: "#5b7fb5", stroke: "#3f5d88", fontSize: 14 },
      },
      {
        tool: "add_element",
        saveAs: "success",
        args: { kind: "ellipse", x: 492, y: 128, width: 156, height: 80, text: "Order success", fill: "#c46b5d", stroke: "#9a5248", fontSize: 14 },
      },
      { tool: "connect_elements", from: (s) => ({ from: s.cart, to: s.addr, label: "next" }) },
      { tool: "connect_elements", from: (s) => ({ from: s.addr, to: s.success, label: "done" }) },
      { tool: "review_canvas" },
      {
        tool: "pin_element",
        from: (s) => ({
          id: s.success,
          note: "Payment is missing between address and success. Add that step before the order is complete.",
        }),
      },
    ],
  },
  {
    label: "Draft from brief",
    hint: "Build the steps",
    icon: <IconNote size={18} />,
    steps: [{ tool: "draft_from_brief" }],
  },
  {
    label: "Review board",
    hint: "Check the brief",
    icon: <IconReview size={18} />,
    steps: [{ tool: "review_canvas" }],
  },
  {
    label: "Login screen",
    hint: "Frame, fields, CTA",
    icon: <IconLayout size={18} />,
    steps: [{ tool: "clear_canvas" }, { tool: "create_layout", args: { template: "login" } }],
  },
  {
    label: "Kanban board",
    hint: "Three columns",
    icon: <IconKanban size={18} />,
    steps: [
      { tool: "clear_canvas" },
      { tool: "set_background", args: { color: LIGHT_BOARD } },
      { tool: "create_layout", args: { template: "kanban" } },
    ],
  },
  {
    label: "Flowchart",
    hint: "Start to end",
    icon: <IconFlow size={18} />,
    steps: [{ tool: "clear_canvas" }, { tool: "create_layout", args: { template: "flowchart" } }],
  },
];

let lineId = 0;

function parseCreatedId(text: string): string | null {
  const m = text.match(/"id"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function parseReview(text: string): ReviewReport | null {
  try {
    const data = JSON.parse(text) as ReviewReport;
    if (!data || !Array.isArray(data.findings)) return null;
    return data;
  } catch {
    return null;
  }
}

export function AgentConsole({ modelContext }: Props) {
  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [lines, setLines] = useState<CallLine[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [argText, setArgText] = useState<string>("{}");
  const [running, setRunning] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewReport | null>(null);
  const [copied, setCopied] = useState(false);
  const activity = useCanvasStore((s) => s.activity);
  const briefReady = useCanvasStore((s) => s.brief.trim().length > 0);
  const logRef = useRef<HTMLDivElement>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(CHATGPT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const refreshTools = useCallback(() => {
    if (!modelContext || typeof modelContext.getTools !== "function") return;
    Promise.resolve(modelContext.getTools())
      .then((t) => {
        const list = Array.isArray(t) ? t : [];
        setTools(list);
        setSelectedTool((prev) => prev || list[0]?.name || "");
      })
      .catch(() => {
        setTools([]);
      });
  }, [modelContext]);

  useEffect(() => {
    refreshTools();
    if (!modelContext || typeof modelContext.addEventListener !== "function") return;
    const handler = () => refreshTools();
    modelContext.addEventListener("toolchange", handler);
    return () => {
      if (typeof modelContext.removeEventListener === "function") {
        modelContext.removeEventListener("toolchange", handler);
      }
    };
  }, [modelContext, refreshTools]);

  const runTool = useCallback(
    async (tool: string, args: Record<string, unknown> | string) => {
      if (!modelContext) return "";
      const argStr = typeof args === "string" ? args : JSON.stringify(args);
      try {
        const result = await modelContext.executeTool(tool, argStr);
        const text = resultToText(result);
        lineId += 1;
        setLines((prev) => [...prev, { id: lineId, tool, args: argStr, result: text }]);
        if (tool === "review_canvas") {
          const parsed = parseReview(text);
          if (parsed) setReview(parsed);
        }
        return text;
      } catch (err) {
        lineId += 1;
        setLines((prev) => [
          ...prev,
          { id: lineId, tool, args: argStr, result: String(err), error: true },
        ]);
        return "";
      }
    },
    [modelContext]
  );

  const runTask = useCallback(
    async (label: string, steps: Step[]) => {
      if (!modelContext || running) return;
      setRunning(label);
      const saved: Record<string, string> = {};
      useCanvasStore.getState().beginAgentBatch();
      pushConfirmBypass();
      try {
        for (const step of steps) {
          const args = step.from ? step.from(saved) : step.args ?? {};
          const text = await runTool(step.tool, args);
          if (step.saveAs) {
            const id = parseCreatedId(text);
            if (id) saved[step.saveAs] = id;
          }
          await new Promise((r) => setTimeout(r, 380));
        }
      } finally {
        popConfirmBypass();
        useCanvasStore.getState().endAgentBatch();
      }
      setRunning(null);
    },
    [modelContext, running, runTool]
  );

  const selectedSchema = useMemo(
    () => tools.find((t) => t.name === selectedTool)?.inputSchema,
    [tools, selectedTool]
  );

  useEffect(() => {
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <section className="panel agent-console">
      <div className="inspector-head">
        <h2>Agent</h2>
      </div>
      <p className="muted small agent-lead">Page tools. Same ones ChatGPT calls.</p>
      <button type="button" className="guide-copy agent-copy" onClick={copyPrompt}>
        {copied ? "Copied" : "Copy prompt"}
      </button>

      <div className="agent-tasks">
        {AGENT_TASKS.map((task) => {
          const needsBrief = task.label === "Draft from brief" || task.label === "Review board";
          const blocked = Boolean(running) || !modelContext || (needsBrief && !briefReady);
          return (
            <button
              key={task.label}
              className={`agent-task-btn${running === task.label ? " is-running" : ""}`}
              disabled={blocked}
              onClick={() => runTask(task.label, task.steps)}
            >
              <span className="agent-task-icon">{task.icon}</span>
              <span className="agent-task-copy">
                <span className="agent-task-label">{task.label}</span>
                <span className="agent-task-hint">
                  {running === task.label
                    ? "Running..."
                    : needsBrief && !briefReady
                      ? "Write a brief first"
                      : task.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {review ? <ReviewFindings report={review} /> : null}

      <div className="log-block">
        <h3>Activity</h3>
        <div className="activity-feed">
          {activity.length === 0 && <p className="muted small">No activity yet.</p>}
          {activity.slice(0, 8).map((a) => (
            <div key={a.id} className={`activity-row actor-${a.actor}`}>
              <span className="actor-badge">{a.actor === "agent" ? "Agent" : "You"}</span>
              <span className="activity-msg" title={a.message}>
                {a.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      <details className="tool-runner">
        <summary>Developer</summary>
        <p className="muted small">Run a tool by name.</p>
        <label className="field">
          <span>Tool</span>
          <select value={selectedTool} onChange={(e) => setSelectedTool(e.target.value)}>
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
                {t.annotations?.readOnlyHint ? " (read-only)" : ""}
              </option>
            ))}
          </select>
        </label>
        {selectedSchema ? <pre className="schema-preview">{JSON.stringify(selectedSchema, null, 2)}</pre> : null}
        <label className="field">
          <span>Arguments (JSON)</span>
          <textarea rows={3} value={argText} onChange={(e) => setArgText(e.target.value)} />
        </label>
        <button
          className="btn-primary"
          disabled={!modelContext || !selectedTool}
          onClick={() => runTool(selectedTool, argText)}
        >
          Run tool
        </button>

        <div className="log-block">
          <h3>Tool calls</h3>
          <div className="call-log" ref={logRef}>
            {lines.length === 0 && <p className="muted small">No calls yet.</p>}
            {lines.map((l) => (
              <details key={l.id} className={`call-line${l.error ? " call-error" : ""}`}>
                <summary className="call-head">
                  <span className="call-tool">{l.tool}</span>
                  <span className={`call-status${l.error ? " is-error" : ""}`}>{l.error ? "Failed" : "Done"}</span>
                </summary>
                <p className="call-args">{l.args}</p>
                <pre className="call-result">{l.result}</pre>
              </details>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function ReviewFindings({ report }: { report: ReviewReport }) {
  return (
    <div className="review-block">
      <h3>Review</h3>
      <p className="review-summary">{report.summary}</p>
      {report.findings.length === 0 ? (
        <p className="muted small">No findings.</p>
      ) : (
        <ul className="finding-list">
          {report.findings.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </ul>
      )}
    </div>
  );
}

const FINDING_KIND: Record<string, string> = {
  brief_gap: "Missing from brief",
  unlabeled: "No label",
  orphan: "Off the path",
  no_start: "No start",
  no_end: "No end",
  overlap: "Overlap",
  empty: "Empty board",
  no_brief: "No brief",
  open_pins: "Open pins",
};

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className={`finding finding-${finding.severity}`}>
      <span className="finding-kind">{FINDING_KIND[finding.code] ?? "Note"}</span>
      <span>{finding.message}</span>
    </li>
  );
}
