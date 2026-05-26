/**
 * Per-chart-type best-practice rules.
 *
 * Sources:
 *   - Few, "Show Me the Numbers" — pie chart slice limits, bar ordering.
 *   - Munzner, "Visualization Analysis & Design" — categorical channel limits.
 *   - Brewer / ColorBrewer — sequential & diverging step recommendations.
 *   - WCAG 2.2 — non-text contrast (1.4.11) ≥ 3:1.
 *
 * User override (PALETTE_VERSION 0.4.0): every categorical chart kind is
 * allowed up to 12 simultaneous slots. The literature ceilings (5–7 for
 * lines, etc.) are demoted to `warn(n)` advisories — the user explicitly
 * wants a 12-slot palette available, and the solver guarantees every
 * reachable N is ΔE / CVD / WCAG compliant. If the runtime probe
 * (`safeMaxN`) can't deliver 12 compliant slots for a given theme /
 * posture, the slider tops out at the highest N that can.
 */
import type { ChartKind } from "./chartKinds";
import type { Posture } from "./constraints";

export interface BestPractice {
  /** Hard cap — beyond this the system collapses into Top-N + "Other". */
  maxN: number;
  /** Soft cap — beyond this the system warns but still renders. */
  recommendedN: number;
  /** Posture is decided here, not by the user. */
  posture: Posture;
  /** Palette family — also decided here. */
  family: "categorical" | "sequential" | "diverging";
  /** One-line "why this rule exists" shown next to the chart. */
  rationale: string;
  /** If false: this chart kind should not be used at all above some N. */
  warn?: (n: number) => string | null;
}

// Common ceiling for categorical kinds — see file header. KPI-posture kinds
// (pie, donut, gauge, etc.) keep tighter caps because they encode
// part-to-whole and would be misleading at 12 slices.
const CAT_MAX = 12;
const CAT_REC = 12;

export const BEST_PRACTICE: Record<ChartKind, BestPractice> = {
  line: {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Lines must be distinguishable in both color and dash. The system caps at 12 series and guarantees every pair stays distinguishable under deutan / protan / tritan / achromatopsia simulation.",
    warn: (n) =>
      n > 7
        ? "Past ~7 series, even a perfect palette starts to feel busy — small multiples often read better."
        : null,
  },
  bar: {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Bars are pre-attentively ordered by length, so they tolerate up to 12 series. Sort by value (already enforced).",
  },
  "stacked-bar": {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Stacking destroys a baseline for every segment except the bottom — decals/dashes carry the signal at high N. Capped at 12 segments.",
    warn: (n) =>
      n > 6 ? "Stacked bars get hard to compare past ~6 segments. Consider 100% stacked or grouped bars." : null,
  },
  scatter: {
    family: "categorical",
    posture: "exploratory",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Scatter encodes group via color + shape. Shape carries the signal when points overlap; color goes up to 12 groups.",
  },
  pie: {
    family: "categorical",
    posture: "kpi",
    maxN: 5,
    recommendedN: 4,
    rationale:
      "Pie charts are only honest with a tiny number of slices and clearly different magnitudes. Above 5 slices, use a sorted bar chart.",
    warn: (n) =>
      n > 5
        ? "Pie charts above 5 slices misrepresent magnitudes. The system caps at 5 — use a bar chart instead."
        : n > 4
        ? "4 slices is the safe ceiling. Consider replacing with a sorted bar chart."
        : null,
  },
  heatmap: {
    family: "sequential",
    posture: "exploratory",
    maxN: 9,
    recommendedN: 7,
    rationale:
      "Sequential ramps need monotonic lightness so they survive grayscale. 5–7 perceptual bins is ColorBrewer's sweet spot; 9 is the ceiling.",
  },
  "diverging-bar": {
    family: "diverging",
    posture: "kpi",
    maxN: 11,
    recommendedN: 9,
    rationale:
      "Diverging ramps need a meaningful midpoint and matched ΔL on both arms. Use an odd number of steps so the midpoint is centered.",
    warn: (n) => (n % 2 === 0 ? "Use an odd number of steps so the neutral midpoint is preserved." : null),
  },

  // --- Additional categorical kinds ---
  area: {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Filled areas occlude each other. The solver guarantees CVD-distinct hues; at high N prefer translucent fills or switch to lines.",
    warn: (n) => (n > 4 ? "Areas overlap heavily above ~4 series — switch to lines or small multiples if readability suffers." : null),
  },
  "stacked-area": {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Same issue as stacked bar but over time — only the bottom band has a baseline. Order bands by stability (most stable at bottom).",
    warn: (n) =>
      n > 6 ? "Stacked areas get hard to compare past ~6 bands. Consider 100% stacked or small multiples." : null,
  },
  "grouped-bar": {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Each group repeats the full palette, so color must be unambiguous at very small widths. Up to 12 categories supported.",
    warn: (n) => (n > 5 ? "Groups of 5+ bars are hard to compare across groups. Consider small multiples." : null),
  },
  bubble: {
    family: "categorical",
    posture: "exploratory",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Bubbles already encode value via size; color groups them. Solver keeps up to 12 groups CVD-distinct.",
  },
  donut: {
    family: "categorical",
    posture: "kpi",
    maxN: 5,
    recommendedN: 4,
    rationale:
      "Donuts share pie's part-to-whole problems. The hole helps you put a KPI inside; the slice rules don't change.",
    warn: (n) => (n > 5 ? "Donuts above 5 slices misrepresent magnitudes. Use a sorted bar chart." : null),
  },
  radar: {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Radar overlays distort area at the perimeter. Solver keeps colors CVD-distinct; legibility still depends on overlap.",
    warn: (n) =>
      n > 4 ? "More than 4 overlays make radar shapes hard to separate — consider parallel coordinates." : null,
  },
  "treemap-categorical": {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Treemap uses size for magnitude; color identifies the top-level group. Up to 12 groups, solver-guaranteed compliant.",
  },
  sankey: {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Sankey colors flows by source category. Past ~6 sources, ribbon overlap eats the palette — collapse minor sources into Other if needed.",
  },

  // --- Additional sequential kinds ---
  "calendar-heatmap": {
    family: "sequential",
    posture: "exploratory",
    maxN: 7,
    recommendedN: 5,
    rationale:
      "Day cells are tiny, so each visible bin must be ≥ ΔE 10 from its neighbor. 5 bins is the practical ceiling for legibility at cell size.",
  },
  choropleth: {
    family: "sequential",
    posture: "exploratory",
    maxN: 7,
    recommendedN: 5,
    rationale:
      "Geographic regions vary wildly in size; small regions need stronger steps to be readable. Use 5 quantile bins by default.",
  },
  "treemap-sequential": {
    family: "sequential",
    posture: "exploratory",
    maxN: 7,
    recommendedN: 5,
    rationale:
      "Treemap cells encode size already; color encodes a secondary continuous metric (e.g. growth %) via a sequential ramp.",
  },
  density: {
    family: "sequential",
    posture: "exploratory",
    maxN: 9,
    recommendedN: 7,
    rationale:
      "Hexbin / density needs many fine steps to show structure. Monotonic-L ramp keeps it grayscale-safe.",
  },

  // --- Additional diverging kinds ---
  "diverging-heatmap": {
    family: "diverging",
    posture: "exploratory",
    maxN: 11,
    recommendedN: 9,
    rationale:
      "Correlation / residuals matrices need a clear sign. Use an odd step count so zero sits on a discrete bin, not between two.",
    warn: (n) => (n % 2 === 0 ? "Use an odd number of steps so zero lands on a bin." : null),
  },
  waterfall: {
    family: "diverging",
    posture: "kpi",
    maxN: 3,
    recommendedN: 3,
    rationale:
      "Waterfall uses exactly three semantic colors: positive contribution, negative contribution, and subtotal. Don't add more.",
    warn: (n) => (n !== 3 ? "Waterfall always uses exactly 3 colors (positive / negative / subtotal)." : null),
  },

  // --- Additional kinds ---
  "step-line": {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Step lines emphasize discrete state changes. Color must be unambiguous because dashes break visually at every step corner.",
  },
  "horizontal-bar": {
    family: "categorical",
    posture: "comparative",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Horizontal bars give long category labels room to breathe and tolerate up to 12 rows. Sort by value.",
  },
  rose: {
    family: "categorical",
    posture: "kpi",
    maxN: 8,
    recommendedN: 6,
    rationale:
      "Rose / polar bars trade exact magnitude comparison for visual rhythm. Keep N small and use only when cyclical structure matters.",
    warn: (n) => (n > 6 ? "Rose charts past 6 wedges become decorative — switch to a sorted bar chart." : null),
  },
  boxplot: {
    family: "categorical",
    posture: "exploratory",
    maxN: CAT_MAX,
    recommendedN: CAT_REC,
    rationale:
      "Boxplots compare distributions across groups. Color identifies the group; whiskers and box edges carry the data.",
  },
  funnel: {
    family: "categorical",
    posture: "kpi",
    maxN: 6,
    recommendedN: 5,
    rationale:
      "Funnel stages are inherently ordered (top → bottom). Use the categorical palette so each stage is identifiable in tooltips and legends.",
  },
  gauge: {
    family: "sequential",
    posture: "kpi",
    maxN: 5,
    recommendedN: 3,
    rationale:
      "Gauges are KPI dials: a sequential ramp encodes the bands (low → high). Keep band count low so the needle reading is unambiguous.",
  },
  candlestick: {
    family: "diverging",
    posture: "kpi",
    maxN: 2,
    recommendedN: 2,
    rationale:
      "Candlesticks use exactly two semantic colors: up (positive) and down (negative). The diverging tokens supply both with matched ΔL.",
    warn: (n) => (n !== 2 ? "Candlestick always uses exactly 2 colors (up / down)." : null),
  },
};
