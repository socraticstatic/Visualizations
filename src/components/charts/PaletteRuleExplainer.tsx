import { LineChart, BarChart3, Layers, ArrowUpDown } from "lucide-react";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import { CHART_KIND_LABEL, type ChartKind } from "@/charts/chartKinds";

/**
 * PaletteRuleExplainer — short, scannable panel placed beside the chart that
 * explains, in plain language, *which* palette rule set is active and *why*
 * the optimizer chose this palette for the current chart kind.
 *
 * Reads directly from `BEST_PRACTICE[kind]` so it always reflects the rules
 * the solver is enforcing — there's no second source of truth to drift from.
 */
export function PaletteRuleExplainer({
  kind,
  n,
  requestedN,
}: {
  kind: ChartKind;
  /** Rendered N after clamping (`chartTheme.effectiveN`). */
  n: number;
  /** Requested N from the slider — shown when it differs from `n`. */
  requestedN: number;
}) {
  const rule = BEST_PRACTICE[kind];
  const familyMeta = FAMILY_META[rule.family];
  const KindIcon = KIND_ICON[kind] ?? BarChart3;

  return (
    <aside
      aria-label="Active palette rule set"
      className="rounded-md border border-border bg-card/30 p-3 space-y-3 text-xs"
    >
      <header className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${familyMeta.tone}`}
          aria-hidden
        >
          <KindIcon className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">
            {CHART_KIND_LABEL[kind]}
            <span className="ml-1 font-normal text-muted-foreground">·</span>{" "}
            <span className={`font-semibold ${familyMeta.text}`}>{familyMeta.label}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Active rule set · posture {rule.posture}
          </div>
        </div>
      </header>

      <p className="text-foreground/80 leading-snug">{familyMeta.why}</p>

      <div className="grid grid-cols-3 gap-2">
        <RuleStat label="Rendering N" value={String(n)} />
        <RuleStat
          label="Recommended"
          value={`≤ ${rule.recommendedN}`}
          tone={n > rule.recommendedN ? "warn" : "ok"}
        />
        <RuleStat
          label="Hard cap"
          value={String(rule.maxN)}
          tone={n > rule.maxN ? "fail" : "ok"}
        />
      </div>

      <div className="rounded border border-border/60 bg-background/40 p-2 text-foreground/85 leading-snug">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
          Why this palette
        </div>
        {rule.rationale}
      </div>

      {n !== requestedN && (
        <div className="text-chart-target text-[11px]">
          Capped from requested N={requestedN} → rendering N={n} (Top-{n} + Other).
        </div>
      )}
    </aside>
  );
}

const FAMILY_META = {
  categorical: {
    label: "Categorical",
    tone: "border-chart-info/40 bg-chart-info/10 text-chart-info-text",
    text: "text-chart-info-text",
    why: "Discrete slots, no inherent order. The solver maximizes pairwise separation against the configured ΔE / CVD floors and WCAG contrast, and slots are paired 1:1 with dash, decal, and marker shape — the redundant channels that carry identity at high N.",
  },
  sequential: {
    label: "Sequential",
    tone: "border-chart-positive/40 bg-chart-positive/10 text-chart-positive-text",
    text: "text-chart-positive-text",
    why: "Single-hue ramp encoding magnitude. Picked to keep ΔE between adjacent bins roughly equal so readers can compare values along the lightness axis without hue confounds.",
  },
  diverging: {
    label: "Diverging",
    tone: "border-chart-target/40 bg-chart-target/10 text-chart-target",
    text: "text-chart-target",
    why: "Two-hue ramp with a neutral midpoint. Picked for signed data so deviation from zero is read by both lightness and hue direction, and both sides are CVD-balanced.",
  },
} as const;

const KIND_ICON: Partial<Record<ChartKind, typeof BarChart3>> = {
  line: LineChart,
  bar: BarChart3,
  "stacked-bar": Layers,
  scatter: ArrowUpDown,
};

function RuleStat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "fail";
}) {
  const toneClass =
    tone === "fail"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "warn"
      ? "border-chart-target/40 bg-chart-target/10 text-chart-target"
      : "border-border bg-background/40 text-foreground";
  return (
    <div className={`rounded border px-2 py-1 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
