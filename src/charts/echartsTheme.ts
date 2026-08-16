/**
 * ECharts theme adapter.
 *
 * Reads chart tokens from CSS variables at runtime, runs the categorical
 * solver (cached), and exposes helpers that auto-apply matched
 * color/dash/decal/shape encodings.
 */
import { fromCssVar, type ColorRecord } from "./palette/distance";
import { solveCategorical, type SolveResult } from "./palette/categorical";
import { sequentialRamp, divergingRamp } from "./palette/ramps";
import { dashScale, decalScale, shapeScale, MAX_SLOTS } from "./encoding";
import { POSTURE, type Posture } from "./constraints";
import { getEditedAnchorIndexes } from "./manualOverrides";

export type Theme = "light" | "dark";

export interface ChartTokens {
  bg: ColorRecord;
  surface: ColorRecord;
  grid: ColorRecord;
  axis: ColorRecord;
  tooltipBg: ColorRecord;
  tooltipFg: ColorRecord;
  muted: ColorRecord;
  other: ColorRecord;
  positive: ColorRecord;
  negative: ColorRecord;
  target: ColorRecord;
  forecast: ColorRecord;
  anchors: ColorRecord[];
  seqLow: ColorRecord;
  seqHigh: ColorRecord;
  divNeg: ColorRecord;
  divMid: ColorRecord;
  divPos: ColorRecord;
}

function readTokens(root: HTMLElement = document.documentElement): ChartTokens {
  return {
    bg: fromCssVar("--chart-bg", root),
    surface: fromCssVar("--chart-surface", root),
    grid: fromCssVar("--chart-grid", root),
    axis: fromCssVar("--chart-axis", root),
    tooltipBg: fromCssVar("--chart-tooltip-bg", root),
    tooltipFg: fromCssVar("--chart-tooltip-fg", root),
    muted: fromCssVar("--chart-muted", root),
    other: fromCssVar("--chart-other", root),
    positive: fromCssVar("--chart-positive", root),
    negative: fromCssVar("--chart-negative", root),
    target: fromCssVar("--chart-target", root),
    forecast: fromCssVar("--chart-forecast", root),
    anchors: [
      fromCssVar("--chart-cat-anchor-1", root),
      fromCssVar("--chart-cat-anchor-2", root),
      fromCssVar("--chart-cat-anchor-3", root),
    ],
    seqLow: fromCssVar("--chart-seq-low", root),
    seqHigh: fromCssVar("--chart-seq-high", root),
    divNeg: fromCssVar("--chart-div-neg", root),
    divMid: fromCssVar("--chart-div-mid", root),
    divPos: fromCssVar("--chart-div-pos", root),
  };
}

/** Where a user-edited anchor ended up in the solved palette. */
export interface AnchorLockStatus {
  /** 0-based index into `tokens.anchors` (Anchor 1 → 0). */
  anchorIndex: number;
  /** The locked color, exactly as it appears in the palette. */
  hex: string;
  /** Palette slot the lock occupies, or null when N is too low to seat it. */
  slot: number | null;
}

export interface ChartTheme {
  theme: Theme;
  tokens: ChartTokens;
  posture: Posture;
  /** Effective N (clamped to MAX_SLOTS and posture cap). */
  effectiveN: number;
  /** True when the requested N exceeded the posture cap and "Other" is in use. */
  overflow: boolean;
  solve: SolveResult;
  /** User-edited anchors passed to the solver as hard locks (empty when the
   *  user has not edited any anchor — the built-in path). */
  anchorLocks: AnchorLockStatus[];
  /** Hex strings ready for ECharts `series.color`. */
  colorHexes: string[];
  /** Aligned encoding slots. */
  dashes: typeof dashScale;
  decals: typeof decalScale;
  shapes: string[];
}

const cache = new Map<string, ChartTheme>();

/**
 * Return an element that has the `.dark` class applied so `getComputedStyle`
 * resolves the dark-mode `--chart-*` tokens defined under `.dark { … }` in
 * `index.css`. The app does not toggle `.dark` on `<html>` (theme is a
 * per-chart concept, not a document concept), so we keep an off-screen
 * `<div class="dark">` mounted under `<body>` and read tokens from there.
 *
 * Without this, `theme === "dark"` requests fell back to `documentElement`,
 * which only has the light tokens — anchors like orange (`28 88% 50%`) then
 * fail the ≥3:1 WCAG contrast probe against the light `#fff` background and
 * `safeMaxN` collapses to 1–2, hard-capping the N slider in the builder.
 */
function ensureThemedRoot(themeClass: "" | "dark"): HTMLElement {
  const selector = themeClass
    ? `div[data-chart-themed-root="dark"]`
    : `div[data-chart-themed-root="light"]`;
  let el = document.querySelector<HTMLElement>(selector);
  if (el) return el;
  // Some tests seed their own `.dark` element with token overrides — prefer
  // any existing one before creating ours (dark only).
  if (themeClass === "dark") {
    const seeded = document.querySelector<HTMLElement>(".dark");
    if (seeded && seeded !== document.documentElement) return seeded;
  }
  el = document.createElement("div");
  el.setAttribute("data-chart-themed-root", themeClass || "light");
  if (themeClass) el.className = themeClass;
  el.style.cssText =
    "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;";
  document.body.appendChild(el);
  return el;
}

export function getChartTheme(theme: Theme, posture: Posture, n: number): ChartTheme {
  const cap = Math.min(POSTURE[posture].maxCategorical, MAX_SLOTS);
  const overflow = n > cap;
  const effectiveN = Math.min(n, cap);
  // Anchors the USER has edited become hard locks (see below), so they are
  // part of the cache identity. Empty (the built-in path) adds nothing but a
  // trailing "|" to the key.
  const editedAnchorIndexes = getEditedAnchorIndexes(theme);
  const key = `${theme}|${posture}|${effectiveN}|${editedAnchorIndexes.join(",")}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, overflow };

  // Always resolve tokens from a dedicated off-screen root per theme so
  // that toggling `.dark` on <html> for page chrome cannot leak into the
  // other-theme chart in compare mode.
  const root = ensureThemedRoot(theme === "dark" ? "dark" : "");
  const tokens = readTokens(root);

  // DEFAULT anchors are preferences, not hard locks: forcing the builtin
  // anchors verbatim made the solver report relaxations whenever one collided
  // under CVD simulation, which collapsed `safeMaxN` to 1–2. With empty locks
  // the solver is free to choose the most compliant colors from the OKLCH
  // candidate cloud, and the built-in no-override path stays byte-identical.
  //
  // USER-EDITED anchors are a different contract: someone testing their own
  // brand color needs that exact color in the palette, so each edited anchor
  // is locked verbatim into a slot (in anchor order, up to N). The solver
  // never nudges a lock; the audit + `solve.relaxations` report every floor
  // the locked color breaks instead of silently discarding it.
  const lockEntries = editedAnchorIndexes
    .filter((i) => i < tokens.anchors.length)
    .map((i) => ({ anchorIndex: i, color: tokens.anchors[i] }));
  const locks = lockEntries.slice(0, effectiveN).map((e) => e.color);

  const solve = solveCategorical({
    n: effectiveN,
    posture,
    background: tokens.bg,
    grid: tokens.grid,
    locks,
  });

  const anchorLocks: AnchorLockStatus[] = lockEntries.map((e, idx) => ({
    anchorIndex: e.anchorIndex,
    hex: e.color.hex,
    slot: idx < effectiveN ? idx : null,
  }));

  const colorHexes = solve.palette.map((c) => c.hex);
  const result: ChartTheme = {
    theme,
    tokens,
    posture,
    effectiveN,
    overflow,
    solve,
    anchorLocks,
    colorHexes,
    dashes: dashScale.slice(0, effectiveN) as typeof dashScale,
    decals: decalScale.slice(0, effectiveN) as typeof decalScale,
    shapes: shapeScale.slice(0, effectiveN),
  };
  cache.set(key, result);
  return { ...result, overflow };
}

export function clearChartThemeCache() {
  cache.clear();
}

/** Base ECharts option fragment: background, axes, grid, tooltip. */
export function buildBase(theme: ChartTheme) {
  const t = theme.tokens;
  return {
    backgroundColor: t.bg.hex,
    textStyle: { color: t.axis.hex, fontFamily: "inherit" },
    grid: { top: 56, left: 56, right: 24, bottom: 40, containLabel: true },
    tooltip: {
      backgroundColor: t.tooltipBg.hex,
      borderWidth: 0,
      textStyle: { color: t.tooltipFg.hex },
    },
    legend: {
      type: "scroll",
      top: 8,
      left: "center",
      textStyle: { color: t.axis.hex },
      pageTextStyle: { color: t.axis.hex },
      pageIconColor: t.axis.hex,
      pageIconInactiveColor: t.grid.hex,
    },
    xAxis: {
      axisLine: { lineStyle: { color: t.axis.hex } },
      axisLabel: { color: t.axis.hex },
      splitLine: { lineStyle: { color: t.grid.hex } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: t.axis.hex } },
      axisLabel: { color: t.axis.hex },
      splitLine: { lineStyle: { color: t.grid.hex } },
    },
  };
}

/**
 * Build a categorical line series with matched dash + symbol per slot.
 *
 * `markers: false` drops the per-point symbols for a cleaner line. Dash
 * patterns stay on regardless — they, not the markers, are what keep series
 * identifiable under CVD simulation and in grayscale.
 */
export function buildLineSeries(
  theme: ChartTheme,
  series: Array<{ name: string; data: Array<[number | string, number]> | number[] }>,
  opts: { markers?: boolean } = {}
) {
  const markers = opts.markers !== false;
  return series.map((s, i) => {
    const slot = i % theme.effectiveN;
    const dash = theme.dashes[slot];
    return {
      name: s.name,
      type: "line" as const,
      data: s.data,
      color: theme.colorHexes[slot],
      symbol: markers ? theme.shapes[slot] : "none",
      symbolSize: 8,
      lineStyle: { width: 2, type: dash === "solid" ? "solid" : (dash as number[]) },
      itemStyle: { color: theme.colorHexes[slot] },
      emphasis: { focus: "series", lineStyle: { width: 3 } },
    };
  });
}

/** Build a categorical bar series with matched decal per slot. */
export function buildBarSeries(
  theme: ChartTheme,
  series: Array<{ name: string; data: number[]; stack?: string }>
) {
  return series.map((s, i) => {
    const slot = i % theme.effectiveN;
    return {
      name: s.name,
      type: "bar" as const,
      stack: s.stack,
      data: s.data,
      itemStyle: {
        color: theme.colorHexes[slot],
        decal: theme.decals[slot],
      },
      emphasis: { focus: "series" },
    };
  });
}

/**
 * Build a sequential or diverging visualMap config.
 *
 * Piecewise, with exactly `steps` bins — one per audited ramp stop — so the
 * colors on screen ARE the colors the accessibility harness audits, and the
 * N slider visibly drives the binning. (The old `type: "continuous"` map
 * interpolated a gradient between fixed endpoints: N changed which stops got
 * audited but had no visible effect on the chart, and intermediate rendered
 * colors were never audited.)
 */
export function buildVisualMap(
  theme: ChartTheme,
  kind: "sequential" | "diverging",
  options: { min: number; max: number; steps?: number }
) {
  const steps = options.steps ?? 7;
  const colors =
    kind === "sequential"
      ? sequentialRamp(theme.tokens.seqLow, theme.tokens.seqHigh, steps).map((c) => c.hex)
      : divergingRamp(theme.tokens.divNeg, theme.tokens.divMid, theme.tokens.divPos, steps).map((c) => c.hex);
  return {
    type: "piecewise" as const,
    splitNumber: steps,
    min: options.min,
    max: options.max,
    inRange: { color: colors },
    textStyle: { color: theme.tokens.axis.hex },
    // Integer bin labels — raw split values print as "15.71429 - 31.42858"
    // (ECharts' auto precision ignores `precision: 0` for fractional splits).
    formatter: (a: number, b: number) => `${Math.round(a)} – ${Math.round(b)}`,
    left: "right" as const,
    top: "middle" as const,
  };
}
