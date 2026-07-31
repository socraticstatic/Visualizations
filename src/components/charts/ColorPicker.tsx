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

function getRoot(theme: Theme): HTMLElement {
  if (theme === "dark") {
    return (document.querySelector(".dark") as HTMLElement | null) ?? document.documentElement;
  }
  return document.documentElement;
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
  const root = getRoot(theme);
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
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
    const root = getRoot(theme);
    root.style.setProperty(varName, triple);
    setValues((v) => ({ ...v, [varName]: hex }));
    onChange();
  }

  function reset() {
    const root = getRoot(theme);
    for (const t of TOKENS) root.style.removeProperty(t.var);
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
        Pick base colors here — the solver will re-derive the full categorical palette and ramps to
        keep ΔE, CVD distance, and contrast within thresholds.
      </p>
    </div>
  );
}
