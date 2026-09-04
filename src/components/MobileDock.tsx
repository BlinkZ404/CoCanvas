export type DockTab = "properties" | "agent";

interface Props {
  tab: DockTab | null;
  onChange: (tab: DockTab | null) => void;
}

export function MobileDock({ tab, onChange }: Props) {
  function toggle(next: DockTab) {
    onChange(tab === next ? null : next);
  }

  return (
    <div className="dock-tabs" role="tablist" aria-label="Board panels">
      <button
        type="button"
        role="tab"
        id="dock-tab-properties"
        aria-selected={tab === "properties"}
        aria-controls="inspector-panel"
        onClick={() => toggle("properties")}
      >
        Properties
      </button>
      <button
        type="button"
        role="tab"
        id="dock-tab-agent"
        aria-selected={tab === "agent"}
        aria-controls="agent-panel"
        onClick={() => toggle("agent")}
      >
        Agent
      </button>
    </div>
  );
}
