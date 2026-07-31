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

/** Every root the ColorPicker writes to for a theme. Must stay in sync with
 *  ColorPicker.getRoots -- the solver reads the [data-chart-themed-root]
 *  divs, not documentElement, so those are the ones that matter. */
function getRoots(theme: Theme): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const roots = new Set<HTMLElement>([document.documentElement]);
  document
    .querySelectorAll<HTMLElement>(
      `[data-chart-themed-root="${theme === "dark" ? "dark" : "light"}"]`
    )
    .forEach((el) => roots.add(el));
  if (theme === "dark") {
    document.querySelectorAll<HTMLElement>(".dark").forEach((el) => roots.add(el));
  }
  return Array.from(roots);
}

export function hasManualColorOverrides(theme: Theme): boolean {
  for (const root of getRoots(theme)) {
    for (const v of TOKEN_VARS) {
      if (root.style.getPropertyValue(v).trim() !== "") return true;
    }
  }
  return false;
}

export function clearManualColorOverrides(): void {
  if (typeof document === "undefined") return;
  const roots = new Set<HTMLElement>([
    document.documentElement,
    ...Array.from(document.querySelectorAll<HTMLElement>(".dark")),
    ...Array.from(document.querySelectorAll<HTMLElement>("[data-chart-themed-root]")),
  ]);
  for (const root of roots) {
    for (const v of TOKEN_VARS) root.style.removeProperty(v);
  }
}
