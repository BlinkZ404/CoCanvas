import { useEffect, useState } from "react";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { registerCoCanvasTools, type RegistrationInfo } from "./webmcp/registerTools";

export default function App() {
  const [reg, setReg] = useState<RegistrationInfo | null>(null);

  useEffect(() => {
    setReg(registerCoCanvasTools());
  }, []);

  useEffect(() => {
    const pinnedSelectors = [".app", ".workspace", ".canvas-surface"];
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target === document || target === document.documentElement || target === document.body) {
        const de = document.documentElement;
        if (de.scrollLeft) de.scrollLeft = 0;
        if (de.scrollTop) de.scrollTop = 0;
        if (document.body.scrollLeft) document.body.scrollLeft = 0;
        if (document.body.scrollTop) document.body.scrollTop = 0;
        return;
      }
      if (target instanceof Element && pinnedSelectors.some((sel) => target.matches(sel))) {
        if (target.scrollLeft) target.scrollLeft = 0;
        if (target.scrollTop) target.scrollTop = 0;
      }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  return (
    <div className="app">
      <TopBar polyfilled={reg?.polyfilled ?? true} toolCount={reg?.toolNames.length ?? 0} />
      <div className="workspace">
        <Toolbar />
        <Canvas />
        <div className="side">
          <Inspector />
        </div>
      </div>
    </div>
  );
}
