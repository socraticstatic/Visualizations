/**
 * Simple color picker for the chart design tokens.
 *
 * Writes hex values back to the active theme's CSS variables as `H S% L%`
 * triples (the format `hsl(var(--token))` expects). The parent passes a
 * `revBump` callback so the chart theme cache is invalidated and charts
 * re-solve their palettes against the new anchors / endpoints / background.
 */
import { useEffect, useState } from "react";
import { converter, parse, formatHex } from "culori";
import type { Theme } from "@/charts/echartsTheme";

const toHsl = converter("hsl");

interface TokenDef {
  var: string;
  label: string;
  group: "Categorical anchors" | "Sequential ramp" | "Diverging ramp" | "Surface";
}

const TOKENS: TokenDef[] = [
  { var: "--chart-cat-anchor-1", label: "Anchor 1", group: "Categorical anchors" },
  { var: "--chart-cat-anchor-2", label: "Anchor 2", group: "Categorical anchors" },
  { var: "--chart-cat-anchor-3", label: "Anchor 3", group: "Categorical anchors" },
  { var: "--chart-seq-low", label: "Low", group: "Sequential ramp" },
  { var: "--chart-seq-high", label: "High", group: "Sequential ramp" },
  { var: "--chart-div-neg", label: "Negative", group: "Diverging ramp" },
  { var: "--chart-div-mid", label: "Midpoint", group: "Diverging ramp" },
  { var: "--chart-div-pos", label: "Positive", group: "Diverging ramp" },
  { var: "--chart-bg", label: "Background", group: "Surface" },
];

/**
 * Every root a token edit must reach.
 *
 * The solver does NOT read tokens off documentElement: getChartTheme resolves
 * them from a detached per-theme div ([data-chart-themed-root]) so compare
 * mode can hold both themes at once. In dark theme that div carries the .dark
 * class, so its stylesheet declarations beat anything inherited from an
 * inline edit on <html> — writing to documentElement alone lit the override
 * banner while the solver, audit, and chart kept the old color (verified
 * live: verdict pinned at 3.77:1 through an edit that should have failed it).
 * Light only worked by cascade luck. Write to every root, explicitly.
 */
function getRoots(theme: Theme): HTMLElement[] {
  const roots = new Set<HTMLElement>([document.documentElement]);
  const themed = document.querySelectorAll<HTMLElement>(
    `[data-chart-themed-root="${theme === "dark" ? "dark" : "light"}"]`
  );
  themed.forEach((el) => roots.add(el));
  if (theme === "dark") {
    document.querySelectorAll<HTMLElement>(".dark").forEach((el) => roots.add(el));
  }
  return Array.from(roots);
}

/** Read from the same root the solver reads, falling back to documentElement. */
function getReadRoot(theme: Theme): HTMLElement {
  return (
    document.querySelector<HTMLElement>(
      `[data-chart-themed-root="${theme === "dark" ? "dark" : "light"}"]`
    ) ?? document.documentElement
  );
}

function hslTripleToHex(triple: string): string {
  const parsed = parse(`hsl(${triple})`);
  return parsed ? (formatHex(parsed) ?? "#000000") : "#000000";
}

function hexToHslTriple(hex: string): string {
  const c = toHsl(parse(hex)!);
  if (!c) return "0 0% 0%";
  const h = Math.round(c.h ?? 0);
  const s = Math.round((c.s ?? 0) * 100);
  const l = Math.round((c.l ?? 0) * 100);
  return `${h} ${s}% ${l}%`;
}

function readToken(theme: Theme, name: string): string {
  const raw = getComputedStyle(getReadRoot(theme)).getPropertyValue(name).trim();
  return raw || "0 0% 0%";
}

export interface ColorPickerProps {
  theme: Theme;
  onChange: () => void;
}

export function ColorPicker({ theme, onChange }: ColorPickerProps) {
  // Re-read tokens whenever the theme flips so the swatches reflect what's
  // actually on the page (including any user overrides already applied).
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const t of TOKENS) next[t.var] = hslTripleToHex(readToken(theme, t.var));
    setValues(next);
  }, [theme]);

  function update(varName: string, hex: string) {
    const triple = hexToHslTriple(hex);
    for (const root of getRoots(theme)) root.style.setProperty(varName, triple);
    setValues((v) => ({ ...v, [varName]: hex }));
    onChange();
  }

  function reset() {
    for (const root of getRoots(theme)) {
      for (const t of TOKENS) root.style.removeProperty(t.var);
    }
    const next: Record<string, string> = {};
    for (const t of TOKENS) next[t.var] = hslTripleToHex(readToken(theme, t.var));
    setValues(next);
    onChange();
  }

  const groups = Array.from(new Set(TOKENS.map((t) => t.group)));

  return (
    <div className="rounded-md border border-chart-grid bg-chart-bg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-chart-axis">
          Color picker · {theme} theme
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-chart-axis hover:text-foreground underline underline-offset-2"
        >
          Reset to defaults
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {groups.map((g) => (
          <div key={g} className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-chart-muted-text">{g}</div>
            <div className="space-y-1.5">
              {TOKENS.filter((t) => t.group === g).map((t) => (
                <label key={t.var} className="flex items-center gap-2 text-xs">
                  <input
                    type="color"
                    value={values[t.var] ?? "#000000"}
                    onChange={(e) => update(t.var, e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-chart-grid bg-transparent p-0"
                    aria-label={`${t.label} color`}
                  />
                  <span className="flex-1 text-foreground/90">{t.label}</span>
                  <span className="tabular-nums text-[10px] text-chart-axis">
                    {(values[t.var] ?? "").toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-chart-axis">
        Background and ramp edits re-solve immediately. Categorical anchors are
        preferences, not locks — the solver still picks the most compliant
        palette, and the audit flags anything your edits break.
      </p>
    </div>
  );
}
