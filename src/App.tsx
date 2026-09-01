import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";

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
      </div>
    </div>
  );
}
