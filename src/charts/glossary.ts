/**
 * Plain-language definitions for every technical term the tool surfaces.
 *
 * Single source of truth for both the ReferenceDrawer list and the inline
 * <Term> popovers, so the two cannot drift apart. Moved out of the old
 * Glossary.tsx panel, which sat collapsed at the bottom of an 8-screen page
 * where nobody found it -- while "ΔE" alone appeared 61 times above it.
 *
 * Each entry links back to the concept's home in the codebase so engineers
 * can verify the math.
 */

export interface GlossaryEntry {
  term: string;
  short: string;
  detail: string;
  /** Where this concept is implemented or enforced. */
  source?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "ΔE (Delta-E)",
    short: "Perceptual color distance.",
    detail:
      "Roughly: how different two colors look to a human eye. We compute Euclidean distance in OKLab × 100, so values are intuitively comparable to ΔE2000. The solver maximizes the minimum pairwise ΔE; the configured pass floors in constraints.ts are deliberately minimal (1 normal, 0.1 CVD) because at high N the dash / decal / shape encodings, not color, carry identity.",
    source: "src/charts/palette/distance.ts",
  },
  {
    term: "OKLab",
    short: "The color space we do all math in.",
    detail:
      "A perceptually-uniform color space. Equal numeric distances look like equal visual differences — unlike sRGB or HSL, where the same jump can look huge in one region and invisible in another. CSS stays HSL, but every comparison happens in OKLab.",
    source: "culori (npm)",
  },
  {
    term: "CVD (Color Vision Deficiency)",
    short: "Colorblindness, simulated.",
    detail:
      "We simulate three dichromacies with the Machado 2009 severity-1.0 matrices: deuteranopia (~1% of men; the broader deutan class is ~6%), protanopia (~1% of men; protan class ~2%), and tritanopia (very rare). The optimizer maximizes the worst-case ΔE across all three so palettes degrade gracefully.",
    source: "src/charts/palette/cvd.ts",
  },
  {
    term: "WCAG 2.2 SC 1.4.11",
    short: "Non-text contrast ≥ 3:1.",
    detail:
      "Web Content Accessibility Guidelines success criterion for graphical objects. Every mark color must be at least 3:1 contrast against the chart background. We compute classic WCAG relative luminance ratios from sRGB.",
    source: "src/charts/audit.ts",
  },
  {
    term: "Posture",
    short: "What this chart is for.",
    detail:
      "Drives default behavior. `kpi` = muted, low-chroma palette for callouts and part-to-whole charts (max 8 slots). `comparative` = balanced, medium chroma (max 12). `exploratory` = highest chroma (max 12). Posture is picked from the chart kind via best-practice rules, not by the user directly.",
    source: "src/charts/constraints.ts",
  },
  {
    term: "Anchor",
    short: "A brand color locked into a slot.",
    detail:
      "Anchors (`--chart-cat-anchor-1/2/3`) are brand-color preferences. The built-in builder solves with no hard locks — forcing anchors verbatim collapsed the safe cap when one collided under CVD simulation — so the solver is free to pick the most compliant palette and anchors act as seeds, not guarantees.",
    source: "src/charts/echartsTheme.ts",
  },
  {
    term: "Decal",
    short: "A pattern overlay for bars and fills.",
    detail:
      "ECharts SVG pattern (dots, stripes, grid). Decal slot N is always paired 1:1 with color slot N, so stacked bars stay distinguishable in print, grayscale, or for users with CVD even when two colors collide.",
    source: "src/charts/encoding.ts",
  },
  {
    term: "Dash",
    short: "Line-stroke pattern.",
    detail:
      "Solid, dashed, dotted, dash-dot. Slot N's dash matches slot N's color and shape — so a line for series 3 is always the same color, dash, and marker symbol, across every chart.",
    source: "src/charts/encoding.ts",
  },
  {
    term: "Shape",
    short: "Marker symbol.",
    detail:
      "Circle, square, triangle, diamond, etc. Used on scatter plots and line markers. Same 1:1 pairing with the color and dash scales — slot 5 is always the same shape everywhere.",
    source: "src/charts/encoding.ts",
  },
  {
    term: "Relaxation",
    short: "What gave when constraints couldn't all be satisfied.",
    detail:
      "If the optimizer can't hit every floor (e.g., N=12 with tight CVD bounds), the audit reports which floors the final palette missed. RELAXATION_ORDER ranks those misses from least to most harmful (grid contrast → ΔL → CVD ΔE → normal ΔE → background ΔE) for humans reading the report — the solver itself runs a single annealing pass rather than loosening constraints stepwise.",
    source: "src/charts/constraints.ts (RELAXATION_ORDER)",
  },
  {
    term: "Top-N + Other",
    short: "Overflow rule.",
    detail:
      "When the user requests more series than the posture cap, the extras collapse into a single `Other` slot drawn with the muted token. Prevents 18-color salads and keeps the chart honest.",
    source: "src/charts/constraints.ts",
  },
  {
    term: "Stable assignment",
    short: "Same entity, same color, every chart.",
    detail:
      "When the rendered N changes (filter from 12 → 4 → 12), a bipartite match against the previous palette keeps each entity on the same color/dash/shape slot whenever possible. No reshuffling during exploration.",
    source: "src/charts/palette/assignment.ts",
  },
];

/** Exact-match lookup. Used by <Term id="..."> to resolve its definition. */
export function lookup(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find((e) => e.term === term);
}
