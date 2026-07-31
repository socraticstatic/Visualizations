/**
 * Reverse lookup: describe the data, get a recommended chart kind.
 *
 * This closes the gap for designers who haven't memorized the chart-kind
 * taxonomy. Inputs are intentionally about the DATA (shape, count, signedness,
 * ordering) — never about the chart. The recommender maps those to a single
 * `ChartKind` from `bestPractices.ts`, plus a recommended N within that kind's
 * best-practice bounds, plus a one-line rationale.
 *
 * "Apply to builder" hands the result straight to ChartsDemo's setKind /
 * setRequestedN, so the rest of the tool re-runs against the new choice.
 */
import { useState } from "react";
import type { ChartKind } from "@/charts/chartKinds";
import { CHART_KIND_LABEL } from "@/charts/chartKinds";
import { BEST_PRACTICE } from "@/charts/bestPractices";

type DataShape =
  | "time-series"
  | "categories"
  | "parts-of-whole"
  | "distribution"
  | "two-numeric"
  | "matrix"
  | "flow"
  | "geo"
  | "kpi-single";

const SHAPE_LABEL: Record<DataShape, string> = {
  "time-series": "Time series (values over time)",
  categories: "Categories compared (one value per group)",
  "parts-of-whole": "Parts of a whole",
  distribution: "Distribution (spread of values)",
  "two-numeric": "Two numeric variables (correlation)",
  matrix: "Matrix (value per row × column)",
  flow: "Flow / movement between nodes",
  geo: "Geographic (value per region)",
  "kpi-single": "Single KPI / progress to target",
};

interface Recommendation {
  kind: ChartKind;
  n: number;
  rationale: string;
}

function recommend(input: {
  shape: DataShape;
  nSeries: number;
  signed: boolean;
}): Recommendation {
  const { shape, nSeries, signed } = input;
  const clampN = (k: ChartKind, n: number) => {
    const r = BEST_PRACTICE[k];
    const minN = r.family === "categorical" ? 1 : 3;
    return Math.min(Math.max(minN, n), r.maxN);
  };
  const out = (kind: ChartKind, n: number, rationale: string): Recommendation => ({
    kind,
    n: clampN(kind, n),
    rationale,
  });

  switch (shape) {
    case "time-series":
      if (signed)
        return out(
          "diverging-bar",
          nSeries,
          "Signed values around a midpoint over time read fastest as a diverging bar — color encodes sign, length encodes magnitude."
        );
      if (nSeries <= 1)
        return out("area", 1, "A single trend reads cleanly as an area chart — the fill emphasizes magnitude.");
      if (nSeries <= 7) return out("line", nSeries, "Lines are the canonical multi-series time chart up to ~7 series.");
      return out(
        "stacked-area",
        nSeries,
        "Above 7 series, individual lines become noise — stacked area emphasizes composition over time. Consider small multiples instead."
      );
    case "categories":
      if (signed)
        return out(
          "diverging-bar",
          nSeries,
          "Signed values per category should diverge from a midpoint, not bar from zero — diverging bar encodes sign in color."
        );
      if (nSeries > 8)
        return out(
          "horizontal-bar",
          nSeries,
          "Above 8 categories, vertical labels collapse — horizontal bars give labels room. Sort by value."
        );
      return out("bar", nSeries, "Bars are pre-attentively length-ordered — the safest comparison chart for ≤ 8 categories.");
    case "parts-of-whole":
      if (nSeries <= 5)
        return out(
          "donut",
          nSeries,
          "Up to 5 slices, a donut communicates share-of-total at a glance. Above 5, switch to a bar."
        );
      return out(
        "bar",
        nSeries,
        "Pies/donuts misrepresent magnitudes above ~5 slices. A sorted bar chart is a more honest part-of-whole."
      );
    case "distribution":
      return out(
        "boxplot",
        nSeries,
        "Boxplots summarize spread (median, quartiles, outliers) without losing structural information."
      );
    case "two-numeric":
      return out(
        "scatter",
        nSeries,
        "Scatter is the canonical two-numeric correlation chart. Use bubble if you have a third (size) dimension."
      );
    case "matrix":
      if (signed)
        return out(
          "diverging-heatmap",
          nSeries,
          "A signed matrix needs a diverging ramp anchored at the midpoint — magnitude AND sign must read."
        );
      return out(
        "heatmap",
        nSeries,
        "Heatmaps surface row × column patterns with a single sequential ramp."
      );
    case "flow":
      return out("sankey", nSeries, "Sankey is the right chart for flow between nodes — width encodes volume.");
    case "geo":
      return out(
        "choropleth",
        nSeries,
        "Choropleth maps value to region fill with a sequential ramp (or diverging if signed)."
      );
    case "kpi-single":
      return out("gauge", nSeries, "Single-value progress / target reads as a gauge with banded sequential color.");
  }
}

interface Props {
  onApply: (kind: ChartKind, n: number) => void;
}

export function ChartRecommender({ onApply }: Props) {
  const [shape, setShape] = useState<DataShape>("time-series");
  const [nSeries, setNSeries] = useState(5);
  const [signed, setSigned] = useState(false);

  const rec = recommend({ shape, nSeries, signed });
  const rule = BEST_PRACTICE[rec.kind];

  return (
    <section className="panel p-4 space-y-3">
      <header className="space-y-0.5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
          Don't know which chart? Describe your data
        </h2>
        <p className="text-[11px] text-chart-axis">
          Map data shape → recommended chart kind. Inputs are about the data, never the chart.
        </p>
      </header>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-chart-axis text-xs">Data shape</span>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as DataShape)}
            className="bg-chart-bg border border-chart-grid rounded px-2 py-1 text-foreground min-w-[280px]"
          >
            {(Object.keys(SHAPE_LABEL) as DataShape[]).map((s) => (
              <option key={s} value={s}>
                {SHAPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-chart-axis text-xs">Number of series / categories</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={20}
              value={nSeries}
              onChange={(e) => setNSeries(Number(e.target.value))}
            />
            <span className="tabular-nums w-6">{nSeries}</span>
          </div>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={signed}
            onChange={(e) => setSigned(e.target.checked)}
          />
          <span className="text-chart-axis">
            Values can be positive AND negative (or diverge from a midpoint)
          </span>
        </label>
      </div>
      <div className="rounded-md border border-chart-info/40 bg-chart-bg p-3 space-y-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-wide text-chart-axis">Recommended</span>
          <span className="text-sm font-medium text-foreground">{CHART_KIND_LABEL[rec.kind]}</span>
          <span className="text-[11px] text-chart-axis">
            family {rule.family} · posture {rule.posture} · N = {rec.n} (rec {rule.recommendedN}, max {rule.maxN})
          </span>
          <button
            type="button"
            onClick={() => onApply(rec.kind, rec.n)}
            className="ml-auto text-xs px-3 py-1 rounded border border-chart-grid bg-chart-info-strong text-chart-bg font-medium hover:opacity-90"
          >
            Apply to builder
          </button>
        </div>
        <p className="text-[11px] text-foreground/80">{rec.rationale}</p>
      </div>
    </section>
  );
}
