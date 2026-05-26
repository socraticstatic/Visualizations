/**
 * Detect whether the user has manually overridden any chart CSS tokens via
 * the ColorPicker. ColorPicker writes inline `style` properties on the root
 * element; reset() removes them. Anything non-empty here means we are no
 * longer in pure built-in mode, and audit warnings become meaningful.
 */
import type { Theme } from "@/charts/echartsTheme";

const TOKEN_VARS = [
  "--chart-cat-anchor-1",
  "--chart-cat-anchor-2",
  "--chart-cat-anchor-3",
  "--chart-seq-low",
  "--chart-seq-high",
  "--chart-div-neg",
  "--chart-div-mid",
  "--chart-div-pos",
  "--chart-bg",
] as const;

function getRoot(theme: Theme): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (theme === "dark") {
    return (document.querySelector(".dark") as HTMLElement | null) ?? document.documentElement;
  }
  return document.documentElement;
}

export function hasManualColorOverrides(theme: Theme): boolean {
  const root = getRoot(theme);
  if (!root) return false;
  for (const v of TOKEN_VARS) {
    if (root.style.getPropertyValue(v).trim() !== "") return true;
  }
  return false;
}

export function clearManualColorOverrides(): void {
  if (typeof document === "undefined") return;
  const roots = new Set<HTMLElement>([
    document.documentElement,
    ...(Array.from(document.querySelectorAll<HTMLElement>(".dark"))),
  ]);
  for (const root of roots) {
    for (const v of TOKEN_VARS) root.style.removeProperty(v);
  }
}
