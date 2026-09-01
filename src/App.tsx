import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>CoCanvas</h1>
          <p>Shared canvas</p>
        </div>
      </header>
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
