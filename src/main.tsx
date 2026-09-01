import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Some browsers automatically scroll a freshly rendered / focused element into
// view. CoCanvas's canvas is a fixed design frame, so focus should never scroll
// (this complements the per-frame scroll pin in the Canvas component).
{
  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options?: FocusOptions) {
    return nativeFocus.call(this, { ...(options ?? {}), preventScroll: true });
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
