import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

try {
  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options?: FocusOptions) {
    return nativeFocus.call(this, { ...(options ?? {}), preventScroll: true });
  };
} catch {
  // Some embedded browsers freeze the prototype. The app still runs.
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p style={{ padding: 24, color: "#f3f1ec", fontFamily: "system-ui" }}>
          CoCanvas hit an error. Reload the page.
        </p>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
