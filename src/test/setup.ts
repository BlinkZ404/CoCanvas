import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { resetConfirmBypass } from "../confirmAction";
import { resetCanvasStore } from "../store/canvasStore";
import { AUTO_BOARD_KEY, THEME_KEY } from "../theme";

function resetHarness() {
  cleanup();
  resetCanvasStore();
  resetConfirmBypass();
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(AUTO_BOARD_KEY);
  document.documentElement.dataset.theme = "";
  document.documentElement.style.colorScheme = "";
}

beforeEach(resetHarness);
afterEach(resetHarness);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}

if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.open = false;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
