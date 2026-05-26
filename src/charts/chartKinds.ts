/**
 * Chart-kind enum + labels. Single source of truth used by the demo UI and the
 * best-practice rules. Each kind is bound to exactly one palette family in
 * `bestPractices.ts` — that's the "appropriate color method" for the kind.
 */
export type ChartKind =
  // Categorical (distinct entities, no inherent order):
  | "line"
  | "step-line"
  | "area"
  | "stacked-area"
  | "bar"
  | "horizontal-bar"
  | "stacked-bar"
  | "grouped-bar"
  | "scatter"
  | "bubble"
  | "pie"
  | "donut"
  | "rose"
  | "radar"
  | "boxplot"
  | "funnel"
  | "treemap-categorical"
  | "sankey"
  // Sequential (ordered single-direction magnitude):
  | "heatmap"
  | "calendar-heatmap"
  | "choropleth"
  | "treemap-sequential"
  | "density"
  | "gauge"
  // Diverging (signed magnitude around a midpoint):
  | "diverging-bar"
  | "diverging-heatmap"
  | "waterfall"
  | "candlestick";

export const CHART_KIND_LABEL: Record<ChartKind, string> = {
  line: "Line",
  "step-line": "Step line",
  area: "Area",
  "stacked-area": "Stacked area",
  bar: "Bar",
  "horizontal-bar": "Horizontal bar",
  "stacked-bar": "Stacked bar",
  "grouped-bar": "Grouped bar",
  scatter: "Scatter",
  bubble: "Bubble",
  pie: "Pie",
  donut: "Donut",
  rose: "Rose / polar",
  radar: "Radar",
  boxplot: "Boxplot",
  funnel: "Funnel",
  "treemap-categorical": "Treemap (categorical)",
  sankey: "Sankey",
  heatmap: "Heatmap",
  "calendar-heatmap": "Calendar heatmap",
  choropleth: "Choropleth",
  "treemap-sequential": "Treemap (sequential)",
  density: "Density / hexbin",
  gauge: "Gauge",
  "diverging-bar": "Diverging bar",
  "diverging-heatmap": "Diverging heatmap",
  waterfall: "Waterfall",
  candlestick: "Candlestick",
};
