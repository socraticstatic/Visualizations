import { CheckCircle2, XCircle, AlertTriangle, Eye } from "lucide-react";
import type { AuditReport, VisionMode } from "@/charts/audit";
import { THRESHOLDS } from "@/charts/constraints";

/**
 * BuilderAuditStatus — concise red/green compliance panel that lives next
 * to the builder controls and re-renders on every builder state change.
 *
 * Shows two layers of validation for the active palette:
 *   1. Per-CVD-mode floor compliance (deutan, protan, tritan,
 *      achromatopsia) — each mode passes only when its minimum pairwise
 *      ΔE clears the configured floor. This is the headline
 *      "CVD floors met + redundant encodings" indicator.
 *   2. Per-chart-type rule compliance (N within the kind's recommended /
 *      hard cap, family match) plus the standard ΔE / WCAG metrics.
 *
 * The component reads the existing live `AuditReport` so it stays in
 * lock-step with the rendered chart — no separate solver pass.
 */
export interface BuilderVariantInfo {
  label: string;
  audit: AuditReport;
  /** Chart kind context — used to validate the palette against per-kind rules. */
  kindLabel: string;
  family: "categorical" | "sequential" | "diverging";
  n: number;
  recommendedN: number;
  maxN: number;
}

export interface BuilderAuditStatusProps {
  a: BuilderVariantInfo;
  /** Variant B (only in compare-normal mode). */
  b?: BuilderVariantInfo;
}

type Status = "pass" | "warn" | "fail";

const CVD_MODES: Array<{ mode: VisionMode; label: string; short: string }> = [
  { mode: "deutan", label: "Deuteranopia (red-green)", short: "Deutan" },
  { mode: "protan", label: "Protanopia (red-green)", short: "Protan" },
  { mode: "tritan", label: "Tritanopia (blue-yellow)", short: "Tritan" },
  { mode: "achromatopsia", label: "Achromatopsia (grayscale)", short: "Mono" },
];

function statusOfMetric(value: number, threshold: number): Status {
  if (!Number.isFinite(value)) return "pass";
  if (value >= threshold) return "pass";
  if (value >= threshold * 0.85) return "warn";
  return "fail";
}

const TONE: Record<Status, { ring: string; text: string; bg: string }> = {
  pass: {
    ring: "border-chart-positive/40",
    text: "text-chart-positive",
    bg: "bg-chart-positive/10",
  },
  warn: {
    ring: "border-chart-target/40",
    text: "text-chart-target",
    bg: "bg-chart-target/10",
  },
  fail: {
    ring: "border-destructive/40",
    text: "text-destructive",
    bg: "bg-destructive/10",
  },
};

function Metric({
  label,
  value,
  threshold,
  unit,
  status,
}: {
  label: string;
  value: number;
  threshold: number;
  unit: string;
  status: Status;
}) {
  const tone = TONE[status];
  const display = !Number.isFinite(value) ? "—" : value.toFixed(unit === ":1" ? 2 : 1);
  return (
    <div
      className={`flex items-center gap-1.5 rounded border ${tone.ring} ${tone.bg} px-2 py-1`}
      title={`${label} — current ${display}${unit}, threshold ≥ ${threshold}${unit}`}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-semibold ${tone.text}`}>
        {display}
        <span className="opacity-80">{unit}</span>
      </span>
      <span className="text-[10px] text-muted-foreground">/ {threshold}</span>
    </div>
  );
}

function CvdChip({
  short,
  label,
  result,
}: {
  short: string;
  label: string;
  result: { minDeltaE: number; threshold: number; pass: boolean } | undefined;
}) {
  const status: Status = !result
    ? "pass"
    : result.pass
    ? "pass"
    : result.minDeltaE >= result.threshold * 0.85
    ? "warn"
    : "fail";
  const tone = TONE[status];
  const Icon = status === "pass" ? CheckCircle2 : status === "warn" ? AlertTriangle : XCircle;
  const dE = result && Number.isFinite(result.minDeltaE) ? result.minDeltaE.toFixed(1) : "—";
  return (
    <div
      className={`flex items-center gap-1 rounded border ${tone.ring} ${tone.bg} px-1.5 py-0.5`}
      title={`${label} — min ΔE ${dE}, threshold ≥ ${result?.threshold ?? "?"}`}
    >
      <Icon className={`h-3 w-3 ${tone.text}`} aria-hidden />
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${tone.text}`}>{short}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{dE}</span>
    </div>
  );
}

function VariantRow({ info }: { info: BuilderVariantInfo }) {
  const { label, audit, kindLabel, family, n, recommendedN, maxN } = info;

  // Per-mode CVD safety — these are the rules a palette must satisfy to be
  // "color-blind safe" for the chart kind.
  const cvdResults = CVD_MODES.map((m) => ({
    ...m,
    result: audit.perVision.find((v) => v.mode === m.mode),
  }));
  const cvdAllPass =
    family === "categorical"
      ? cvdResults.every((r) => r.result?.pass ?? true)
      : true; // sequential/diverging don't rely on pairwise categorical ΔE

  // Per-kind rule: N within recommended/hard cap.
  const nStatus: Status =
    n > maxN ? "fail" : n > recommendedN ? "warn" : "pass";

  const normalResult = audit.perVision.find((v) => v.mode === "normal");
  const dE = normalResult?.minDeltaE ?? Infinity;
  const wcag = audit.worstContrastVsBg;
  const dEStatus = statusOfMetric(dE, THRESHOLDS.minDeltaENormal);
  const wcagStatus = statusOfMetric(wcag, 3);

  // Overall compliance = audit overall + chart-kind rule + CVD coverage.
  const overall: Status = !audit.bgPass || nStatus === "fail" || (!cvdAllPass && family === "categorical")
    ? "fail"
    : audit.overall === "warn" || nStatus === "warn" || dEStatus !== "pass"
    ? "warn"
    : "pass";
  const tone = TONE[overall];
  const Icon = overall === "pass" ? CheckCircle2 : overall === "warn" ? AlertTriangle : XCircle;

  const cbTone = TONE[cvdAllPass ? "pass" : "fail"];
  const CbIcon = cvdAllPass ? CheckCircle2 : XCircle;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={`flex items-center gap-1.5 rounded-full border ${tone.ring} ${tone.bg} px-2 py-0.5`}
          role="status"
          aria-live="polite"
        >
          <Icon className={`h-3.5 w-3.5 ${tone.text}`} aria-hidden />
          <span className={`text-xs font-semibold ${tone.text}`}>{label}</span>
          <span className={`text-[10px] uppercase tracking-wide ${tone.text} opacity-80`}>
            {overall}
          </span>
        </div>

        {/* Headline color-blind-safe compliance indicator. */}
        <div
          className={`flex items-center gap-1.5 rounded-full border ${cbTone.ring} ${cbTone.bg} px-2 py-0.5`}
          title={
            family !== "categorical"
              ? `${family} palette — per-mode pairwise ΔE doesn't apply; sequential ordering carries the signal.`
              : cvdAllPass
              ? "Every pair of slots clears the configured per-mode ΔE floor under deutan, protan, tritan and achromatopsia simulation. The floors are deliberately minimal at high N — the paired dash / decal / shape encodings carry identity where color alone cannot."
              : "At least one pair of slots falls below the configured CVD ΔE floor. Reduce N or change the palette."
          }
        >
          <CbIcon className={`h-3.5 w-3.5 ${cbTone.text}`} aria-hidden />
          <Eye className={`h-3 w-3 ${cbTone.text} opacity-70`} aria-hidden />
          <span className={`text-[11px] font-semibold ${cbTone.text}`}>
            {family !== "categorical"
              ? "CVD-safe (ramp)"
              : cvdAllPass
              ? "CVD floors met + redundant encodings"
              : "Below CVD floor"}
          </span>
        </div>

        {/* Per-kind N rule. */}
        <div
          className={`flex items-center gap-1 rounded border ${TONE[nStatus].ring} ${TONE[nStatus].bg} px-2 py-1`}
          title={`${kindLabel}: recommended N ≤ ${recommendedN}, hard cap ${maxN}`}
        >
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {kindLabel} · N
          </span>
          <span className={`font-mono text-xs font-semibold ${TONE[nStatus].text}`}>{n}</span>
          <span className="text-[10px] text-muted-foreground">/ {recommendedN}</span>
        </div>
      </div>

      {/* Per-CVD-mode breakdown: live minimum pairwise ΔE vs. each floor. */}
      {family === "categorical" && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          {cvdResults.map((r) => (
            <CvdChip key={r.mode} short={r.short} label={r.label} result={r.result} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Metric
          label="ΔE"
          value={dE}
          threshold={THRESHOLDS.minDeltaENormal}
          unit=""
          status={dEStatus}
        />
        <Metric label="WCAG" value={wcag} threshold={3} unit=":1" status={wcagStatus} />
      </div>
    </div>
  );
}

export function BuilderAuditStatus({ a, b }: BuilderAuditStatusProps) {
  return (
    <div
      className="space-y-3 rounded-md border border-border bg-card/30 p-2"
      aria-label="Live palette compliance status"
    >
      <VariantRow info={a} />
      {b && (
        <>
          <div className="h-px bg-border" aria-hidden />
          <VariantRow info={b} />
        </>
      )}
    </div>
  );
}
