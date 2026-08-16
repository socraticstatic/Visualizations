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
import type { AnchorLockStatus, Theme } from "@/charts/echartsTheme";
import {
  ANCHOR_VARS,
  clearEditedAnchors,
  markAnchorEdited,
} from "@/charts/manualOverrides";

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
  /** Per-anchor lock status from the current solve (chartTheme.anchorLocks):
   *  which edited anchors made it into the palette, and at which slot. */
  anchorStatus?: AnchorLockStatus[];
}

export function ColorPicker({ theme, onChange, anchorStatus }: ColorPickerProps) {
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
    // An edited categorical anchor becomes a hard lock in the solver — record
    // it so getChartTheme knows this anchor is a user color, not a default.
    const anchorIndex = (ANCHOR_VARS as readonly string[]).indexOf(varName);
    if (anchorIndex !== -1) markAnchorEdited(theme, anchorIndex);
    setValues((v) => ({ ...v, [varName]: hex }));
    onChange();
  }

  function reset() {
    clearEditedAnchors(theme);
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
              {g === "Categorical anchors" && anchorStatus && anchorStatus.length > 0 && (
                <ul className="space-y-0.5 pt-1" data-testid="anchor-lock-status">
                  {anchorStatus.map((s) => (
                    <li key={s.anchorIndex} className="text-[10px] tabular-nums text-chart-axis">
                      Anchor {s.anchorIndex + 1} ({s.hex.toUpperCase()}):{" "}
                      {s.slot !== null
                        ? `locked into palette slot ${s.slot}`
                        : "not used — N is below this anchor's slot"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-chart-axis">
        Background and ramp edits re-solve immediately. Anchors you edit are
        locked verbatim into the palette, in slot order — the solver never
        nudges them, and the audit below tells you exactly what they break.
      </p>
    </div>
  );
}
