/**
 * Emphasis preview — show the same chart with one "hero" series at full
 * chroma and every other series collapsed to the muted token. This is the
 * storytelling pattern: guide the reader's eye to one entity while keeping
 * the rest as context.
 *
 * Designers can verify the palette degrades gracefully: the hero stays
 * legible, the context stays readable, and dash/shape still distinguish
 * the muted series from each other if needed.
 */
import { useMemo, useState } from "react";
import type { ChartTheme } from "@/charts/echartsTheme";
import { buildBase, buildBarSeries, buildLineSeries } from "@/charts/echartsTheme";
import type { ChartKind } from "@/charts/chartKinds";
import { EChart } from "./EChart";

const SERIES_NAMES = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Soylent", "Wonka", "Cyberdyne", "Massive", "Stark", "Tyrell", "Wayne"];

function genLine(n: number, points = 24) {
  return Array.from({ length: n }, (_, i) => {
    const seed = i * 13;
    return {
      name: SERIES_NAMES[i],
      data: Array.from({ length: points }, (_, j) => {
        const v = 50 + 30 * Math.sin((j + seed) / 4) + 20 * Math.cos((j + seed) / 7) + i * 6;
        return [j, Math.round(v)] as [number, number];
      }),
    };
  });
}

function genBar(n: number) {
  const cats = ["Q1", "Q2", "Q3", "Q4"];
  return {
    categories: cats,
    series: Array.from({ length: n }, (_, i) => ({
      name: SERIES_NAMES[i],
      data: cats.map((_, j) => 20 + ((i * 7 + j * 11) % 30) + i * 3),
    })),
  };
}

interface Props {
  theme: ChartTheme;
  /** Only line/bar/area-like kinds make sense for emphasis; otherwise hidden. */
  kind: ChartKind;
}

const SUPPORTED: ChartKind[] = ["line", "bar", "stacked-bar", "grouped-bar", "horizontal-bar", "area", "stacked-area", "step-line"];

export function EmphasisPreview({ theme, kind }: Props) {
  const [hero, setHero] = useState(0);
  const supported = SUPPORTED.includes(kind);
  const n = theme.effectiveN;

  const option = useMemo(() => {
    if (!supported) return null;
    const base = buildBase(theme);
    const muted = theme.tokens.muted.hex;

    const isBar = kind === "bar" || kind === "stacked-bar" || kind === "grouped-bar" || kind === "horizontal-bar";

    if (isBar) {
      const { categories, series } = genBar(n);
      const built = buildBarSeries(theme, series.map((s, i) => ({
        name: s.name,
        data: s.data,
        stack: kind === "stacked-bar" ? "total" : undefined,
      }))).map((s, i) => ({
        ...s,
        itemStyle: {
          ...s.itemStyle,
          color: i === hero ? s.itemStyle.color : muted,
          decal: i === hero ? s.itemStyle.decal : undefined,
          opacity: i === hero ? 1 : 0.65,
        },
        z: i === hero ? 10 : 1,
      }));
      const horiz = kind === "horizontal-bar";
      return {
        ...base,
        legend: { ...base.legend, top: 0 },
        xAxis: horiz
          ? { ...base.xAxis, type: "value" }
          : { ...base.xAxis, type: "category", data: categories },
        yAxis: horiz
          ? { ...base.yAxis, type: "category", data: categories }
          : { ...base.yAxis, type: "value" },
        series: built,
      };
    }

    // line family
    const built = buildLineSeries(theme, genLine(n)).map((s, i) => ({
      ...s,
      color: i === hero ? s.color : muted,
      itemStyle: { color: i === hero ? s.color : muted },
      lineStyle: { ...s.lineStyle, width: i === hero ? 3 : 1, opacity: i === hero ? 1 : 0.55 },
      symbol: i === hero ? s.symbol : "none",
      z: i === hero ? 10 : 1,
      ...(kind === "area" || kind === "stacked-area"
        ? {
            areaStyle: { color: i === hero ? s.color : muted, opacity: i === hero ? 0.45 : 0.18 },
            ...(kind === "stacked-area" ? { stack: "total" } : {}),
          }
        : {}),
      ...(kind === "step-line" ? { step: "end" as const } : {}),
    }));
    return {
      ...base,
      legend: { ...base.legend, top: 0 },
      xAxis: { ...base.xAxis, type: "value" },
      yAxis: { ...base.yAxis, type: "value" },
      series: built,
    };
  }, [supported, kind, theme, hero, n]);

  if (!supported) {
    return (
      <section className="rounded-lg border border-chart-grid bg-chart-surface p-4 space-y-2">
        <header>
          <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
            Emphasis preview
          </h2>
          <p className="text-[11px] text-chart-axis mt-0.5">
            Available for line, bar, and area chart kinds. Pick one of those to preview the
            storytelling treatment (one hero series, the rest muted to context).
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-chart-grid bg-chart-surface p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
            Emphasis preview
          </h2>
          <p className="text-[11px] text-chart-axis mt-0.5">
            Storytelling pattern: one hero series at full chroma, every other series collapses
            to <code className="font-mono">--chart-muted</code> as context. Use to guide a
            reader's eye to a single entity without losing the rest.
          </p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-chart-axis">Hero:</span>
        {Array.from({ length: n }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setHero(i)}
            className={`px-2 py-1 rounded border transition-colors ${
              i === hero
                ? "border-foreground bg-chart-bg text-foreground"
                : "border-chart-grid bg-chart-bg/40 text-chart-axis hover:bg-chart-bg"
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm mr-1.5 align-middle"
              style={{ backgroundColor: theme.colorHexes[i] }}
              aria-hidden
            />
            {SERIES_NAMES[i]}
          </button>
        ))}
      </div>
      <div className="rounded border border-chart-grid bg-chart-bg overflow-hidden">
        <EChart option={option as Record<string, unknown>} height={300} />
      </div>
    </section>
  );
}
