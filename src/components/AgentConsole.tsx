import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCanvasStore } from "../store/canvasStore";
import { resultToText, type ModelContextLike, type RegisteredTool } from "../webmcp/polyfill";
import { IconFlow, IconGrid, IconKanban, IconLayout, IconMoon, IconNote, IconSpark } from "./Icons";

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
}

/**
 * Scripted "agent tasks" that drive the canvas purely through the WebMCP tool
 * surface (document.modelContext.executeTool). This is a stand-in for a real
 * agent so the human+agent collaboration is demonstrable in any browser; a real
 * WebMCP agent uses the exact same tools.
 */
const AGENT_TASKS: { label: string; hint: string; icon: ReactNode; steps: Step[] }[] = [
  {
    label: "Login screen",
    hint: "Frame, fields, CTA",
    icon: <IconLayout />,
    steps: [{ tool: "clear_canvas" }, { tool: "create_layout", args: { template: "login" } }],
  },
  {
    label: "Kanban board",
    hint: "Three columns",
    icon: <IconKanban />,
    steps: [
      { tool: "clear_canvas" },
      { tool: "set_background", args: { color: "#f6f4ef" } },
      { tool: "create_layout", args: { template: "kanban" } },
    ],
  },
  {
    label: "Flowchart",
    hint: "Start to end",
    icon: <IconFlow />,
    steps: [{ tool: "clear_canvas" }, { tool: "create_layout", args: { template: "flowchart" } }],
  },
  {
    label: "Brainstorm",
    hint: "Sticky notes",
    icon: <IconNote />,
    steps: [
      { tool: "set_background", args: { color: "#f6f4ef" } },
      { tool: "add_element", args: { kind: "sticky", x: 100, y: 100, text: "Idea: agent onboarding", fill: "#f3e4c6", stroke: "#d4b57a" } },
      { tool: "add_element", args: { kind: "sticky", x: 320, y: 130, text: "Idea: shared cursors", fill: "#f0d6d0", stroke: "#d4a39a" } },
      { tool: "add_element", args: { kind: "sticky", x: 200, y: 300, text: "Idea: tool marketplace", fill: "#d7e6d8", stroke: "#8fad93" } },
      { tool: "arrange_grid", args: { columns: 3 } },
    ],
  },
  {
    label: "Tidy grid",
    hint: "Auto-arrange",
    icon: <IconGrid />,
    steps: [{ tool: "arrange_grid", args: { columns: 3 } }],
  },
  {
    label: "Dark canvas",
    hint: "Ink background",
    icon: <IconMoon />,
    steps: [{ tool: "set_background", args: { color: "#12141a" } }],
  },
];

let lineId = 0;

export function AgentConsole({ modelContext }: Props) {
  const [tools, setTools] = useState<RegisteredTool[]>([]);
  const [lines, setLines] = useState<CallLine[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [argText, setArgText] = useState<string>("{}");
  const [running, setRunning] = useState<string | null>(null);
  const activity = useCanvasStore((s) => s.activity);
  const logRef = useRef<HTMLDivElement>(null);

  const refreshTools = useCallback(() => {
    if (!modelContext) return;
    Promise.resolve(modelContext.getTools()).then((t) => {
      setTools(t);
      setSelectedTool((prev) => prev || t[0]?.name || "");
    });
  }, [modelContext]);

  useEffect(() => {
    refreshTools();
    if (!modelContext) return;
    const handler = () => refreshTools();
    modelContext.addEventListener("toolchange", handler);
    return () => modelContext.removeEventListener("toolchange", handler);
  }, [modelContext, refreshTools]);

  const runTool = useCallback(
    async (tool: string, args: Record<string, unknown> | string) => {
      if (!modelContext) return;
      const argStr = typeof args === "string" ? args : JSON.stringify(args);
      try {
        const result = await modelContext.executeTool(tool, argStr);
        const text = resultToText(result);
        lineId += 1;
        setLines((prev) => [...prev, { id: lineId, tool, args: argStr, result: text }]);
      } catch (err) {
        lineId += 1;
        setLines((prev) => [
          ...prev,
          { id: lineId, tool, args: argStr, result: String(err), error: true },
        ]);
      }
    },
    [modelContext]
  );

  const runTask = useCallback(
    async (label: string, steps: Step[]) => {
      if (!modelContext || running) return;
      setRunning(label);
      for (const step of steps) {
        await runTool(step.tool, step.args ?? {});
        await new Promise((r) => setTimeout(r, 450));
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
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <section className="panel agent-console">
      <div className="inspector-head">
        <h2>Agent</h2>
        <span className="mono-tag">
          <IconSpark size={12} />
          {tools.length} tools
        </span>
      </div>
      <p className="muted small agent-lead">
        Run a prompt to build on the canvas.
      </p>

      <div className="agent-tasks">
        {AGENT_TASKS.map((task) => (
          <button
            key={task.label}
            className={`agent-task-btn${running === task.label ? " is-running" : ""}`}
            disabled={Boolean(running) || !modelContext}
            onClick={() => runTask(task.label, task.steps)}
          >
            <span className="agent-task-icon">{task.icon}</span>
            <span className="agent-task-copy">
              <span className="agent-task-label">{task.label}</span>
              <span className="agent-task-hint">{running === task.label ? "Running..." : task.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="log-block">
        <h3>Activity</h3>
        <div className="activity-feed">
          {activity.length === 0 && <p className="muted small">No activity yet.</p>}
          {activity.slice(0, 8).map((a) => (
            <div key={a.id} className={`activity-row actor-${a.actor}`}>
              <span className="actor-badge">{a.actor === "agent" ? "Agent" : "You"}</span>
              <span className="activity-msg">{a.message}</span>
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
