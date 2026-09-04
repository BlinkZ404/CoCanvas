export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.1;

export function clampZoom(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const snapped = Math.round(n * 20) / 20;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, snapped));
}

export function nudgeZoom(current: number, dir: 1 | -1): number {
  return clampZoom(current + dir * ZOOM_STEP);
}

export function surfaceZoom(surface: HTMLElement): number {
  const n = Number(surface.dataset?.zoom);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function scrollAfterZoom(
  surface: HTMLElement,
  oldZoom: number,
  nextZoom: number,
  clientX: number,
  clientY: number
) {
  const rect = surface.getBoundingClientRect();
  const bx = (clientX - rect.left + surface.scrollLeft) / oldZoom;
  const by = (clientY - rect.top + surface.scrollTop) / oldZoom;
  surface.scrollLeft = Math.max(0, bx * nextZoom - (clientX - rect.left));
  surface.scrollTop = Math.max(0, by * nextZoom - (clientY - rect.top));
}
