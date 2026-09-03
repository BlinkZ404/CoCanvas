import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useCanvasStore } from "../store/canvasStore";
import {
  THEME_OPTIONS,
  applyTheme,
  boardForTheme,
  clearAutoBoardFrom,
  persistThemePref,
  readThemePref,
  rememberAutoBoardFrom,
  resolveTheme,
  type ThemePref,
} from "../theme";
import { IconMoon, IconSun, IconSystem } from "./Icons";

function syncBoard(resolved: ReturnType<typeof resolveTheme>) {
  const current = useCanvasStore.getState().background;
  const next = boardForTheme(current, resolved);
  if (!next) return;
  if (resolved === "dark") rememberAutoBoardFrom(current);
  useCanvasStore.getState().setBackground(next, "human", { log: false, undo: false, themeSync: true });
  if (resolved === "light") clearAutoBoardFrom();
}

const THEME_ICONS: Record<ThemePref, typeof IconSun> = {
  light: IconSun,
  dark: IconMoon,
  system: IconSystem,
};

export function ThemeToggle() {
  const labelId = useId();
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const [note, setNote] = useState("");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    applyTheme(pref);
    persistThemePref(pref);
    syncBoard(resolveTheme(pref));
  }, [pref]);

  useEffect(() => {
    if (pref !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      syncBoard(resolveTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  function choose(next: ThemePref) {
    setPref(next);
    const resolved = resolveTheme(next);
    const label = THEME_OPTIONS.find((item) => item.value === next)?.label ?? next;
    setNote(next === "system" ? `Match system, currently ${resolved}` : label);
  }

  function onGroupKey(e: KeyboardEvent<HTMLDivElement>) {
    const index = THEME_OPTIONS.findIndex((item) => item.value === pref);
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % THEME_OPTIONS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = THEME_OPTIONS.length - 1;
    else return;
    e.preventDefault();
    choose(THEME_OPTIONS[next].value);
    buttons.current[next]?.focus();
  }

  return (
    <div className="theme-toggle-wrap">
      <div
        className="theme-toggle"
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onGroupKey}
      >
        <span id={labelId} className="sr-only">
          Color theme
        </span>
        {THEME_OPTIONS.map((item, index) => {
          const Icon = THEME_ICONS[item.value];
          const checked = pref === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={item.label}
              title={item.label}
              tabIndex={checked ? 0 : -1}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              onClick={() => choose(item.value)}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
