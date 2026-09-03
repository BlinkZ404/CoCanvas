import { afterEach, describe, expect, it } from "vitest";
import {
  DARK_BOARD,
  LIGHT_BOARD,
  THEME_KEY,
  applyTheme,
  boardForTheme,
  clearAutoBoardFrom,
  inkOnBoard,
  isDarkColor,
  luminance,
  persistThemePref,
  readThemePref,
  rememberAutoBoardFrom,
  resolveTheme,
  stockBoardForTheme,
} from "./theme";

describe("luminance and ink", () => {
  it("treats night as dark and paper as light", () => {
    expect(isDarkColor(DARK_BOARD)).toBe(true);
    expect(isDarkColor(LIGHT_BOARD)).toBe(false);
    expect(luminance("#ffffff")).toBeGreaterThan(luminance("#000000"));
  });

  it("returns a light ink when dark text sits on a dark board", () => {
    expect(inkOnBoard("#1a1a1e", DARK_BOARD)).toBe("#f4f6f8");
  });

  it("keeps a mid fill as-is", () => {
    expect(inkOnBoard("#5b7fb5", LIGHT_BOARD)).toBe("#5b7fb5");
  });

  it("swaps stock paper to night in dark mode", () => {
    expect(boardForTheme("#f6f4ef", "dark")).toBe(DARK_BOARD);
    expect(boardForTheme("#5b7fb5", "dark")).toBeNull();
    expect(stockBoardForTheme("dark")).toBe(DARK_BOARD);
  });

  it("keeps a chosen night board in light chrome unless the swap was automatic", () => {
    expect(boardForTheme(DARK_BOARD, "light")).toBeNull();
    rememberAutoBoardFrom(LIGHT_BOARD);
    expect(boardForTheme(DARK_BOARD, "light")).toBe(LIGHT_BOARD);
    clearAutoBoardFrom();
    expect(boardForTheme(DARK_BOARD, "light")).toBeNull();
  });
});

describe("theme preference", () => {
  afterEach(() => {
    localStorage.removeItem(THEME_KEY);
  });

  it("defaults to system and persists a choice", () => {
    expect(readThemePref()).toBe("system");
    persistThemePref("dark");
    expect(readThemePref()).toBe("dark");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });

  it("applies the resolved theme on the document", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
