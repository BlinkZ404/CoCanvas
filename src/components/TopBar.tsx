import { LogoMark } from "./Icons";

interface Props {
  polyfilled: boolean;
  toolCount: number;
}

export function TopBar({ polyfilled, toolCount }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark />
        <div>
          <h1>CoCanvas</h1>
          <p>Product flows, with your agent</p>
        </div>
      </div>
      <div className="topbar-status">
        <span className="pill" title="Tools registered on this page for agents">
          {toolCount} tools
        </span>
        <span
          className={polyfilled ? "pill pill-warn" : "pill pill-live"}
          title={
            polyfilled
              ? "No native WebMCP. Using the built-in polyfill."
              : "Native WebMCP is available on this page."
          }
        >
          <span className="status-dot" aria-hidden />
          {polyfilled ? "Polyfill" : "Native"}
        </span>
      </div>
    </header>
  );
}
