export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "cocanvas.theme";
export const AUTO_BOARD_KEY = "cocanvas.boardAutoFrom";

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match system" },
];

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Storage unavailable.
  }
  return "system";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePref) {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function persistThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Preference still applies for this visit.
  }
}

export const LIGHT_BOARD = "#f6f4ef";
export const DARK_BOARD = "#1e2128";
const LIGHT_BOARDS = new Set(["#f6f4ef", "#eef1f6", "#e8eee9"]);

export function stockBoardForTheme(resolved: ResolvedTheme): string {
  return resolved === "dark" ? DARK_BOARD : LIGHT_BOARD;
}

export function readAutoBoardFrom(): string | null {
  try {
    const value = localStorage.getItem(AUTO_BOARD_KEY);
    return value && value.startsWith("#") ? value : null;
  } catch {
    return null;
  }
}

export function rememberAutoBoardFrom(from: string) {
  try {
    localStorage.setItem(AUTO_BOARD_KEY, from.trim().toLowerCase());
  } catch {
    // Storage unavailable.
  }
}

export function clearAutoBoardFrom() {
  try {
    localStorage.removeItem(AUTO_BOARD_KEY);
  } catch {
    // Storage unavailable.
  }
}

export function luminance(hex: string): number {
  const raw = hex.trim().replace("#", "");
  if (raw.length !== 6) return 1;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return 1;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.42;
}

/** Keep free text readable when the board flips with the chrome theme. */
export function inkOnBoard(fill: string, board: string): string {
  const fillDark = isDarkColor(fill);
  const boardDark = isDarkColor(board);
  if (boardDark && fillDark) return "#f4f6f8";
  if (!boardDark && !fillDark && luminance(fill) > 0.82) return "#17181c";
  return fill;
}

/** Swap stock paper for Night when chrome goes dark. Only reverse an auto swap. */
export function boardForTheme(current: string, resolved: ResolvedTheme): string | null {
  const bg = current.trim().toLowerCase();
  if (resolved === "dark" && LIGHT_BOARDS.has(bg)) return DARK_BOARD;
  if (resolved === "light" && bg === DARK_BOARD) return readAutoBoardFrom();
  return null;
}
