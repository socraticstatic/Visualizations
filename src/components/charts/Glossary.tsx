/**
 * Glossary — plain-language definitions for every technical term the tool
 * surfaces. Collapsible so it stays out of the way until a designer needs it.
 *
 * Each entry links back to the concept's home in the codebase so engineers
 * can verify the math.
 */
import { useState } from "react";

interface Entry {
  term: string;
  short: string;
  detail: string;
  /** Where this concept is implemented or enforced. */
  source?: string;
}

const ENTRIES: Entry[] = [
  {
    term: "ΔE (Delta-E)",
    short: "Perceptual color distance.",
    detail:
      "Roughly: how different two colors look to a human eye. We compute Euclidean distance in OKLab × 100, so values are intuitively comparable to ΔE2000. Categorical slots target ΔE ≥ 18 under normal vision; ≥ 10 under simulated colorblindness.",
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
      "We simulate three CVD types with the Machado 2009 matrices: deuteranopia (~6% of men, green-weak), protanopia (~2% of men, red-weak), and tritanopia (rare, blue-weak). The optimizer maximizes the worst-case ΔE across all three so palettes degrade gracefully.",
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
      "Drives default behavior. `kpi` = one bold highlight + grey context (max 1 categorical slot). `comparative` = balanced, distinct colors (max 6). `exploratory` = rich palette, more chroma (max 12). Posture is picked from the chart kind via best-practice rules, not by the user directly.",
    source: "src/charts/constraints.ts",
  },
  {
    term: "Anchor",
    short: "A brand color locked into a slot.",
    detail:
      "Anchors (`--chart-cat-anchor-1/2/3`) are inserted verbatim into the categorical palette. The optimizer fills the remaining slots around them and never moves an anchor. The only failure mode is an anchor that itself fails contrast against the background.",
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

export function Glossary() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-chart-grid bg-chart-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
            Glossary
          </h2>
          <p className="text-[11px] text-chart-axis mt-0.5">
            Plain-language definitions for every term in the audit and reports.
          </p>
        </div>
        <span className="text-xs text-chart-axis font-mono">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {ENTRIES.map((e) => (
              <div key={e.term} className="space-y-1">
                <dt className="text-sm font-medium text-foreground">{e.term}</dt>
                <dd className="text-xs text-chart-axis">
                  <span className="text-foreground/80">{e.short}</span> {e.detail}
                  {e.source && (
                    <span className="block mt-0.5 font-mono text-[10px] text-chart-axis/70">
                      {e.source}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
