/**
 * The prioritized warning list for any (kind, N, audit) tuple.
 *
 * Lived inside ChartsDemo until it needed tests. Behaviour is unchanged from
 * that version apart from one fix: commit 662346a split the single `capped`
 * flag into `collapsed` and `aboveSafe` but missed a `!capped` in the
 * above-recommended branch, leaving an undefined identifier there. It never
 * threw because the slider clamps N to `recommendedN`, so the comparison
 * short-circuits first. DiffSummary's equivalent line shows the intent:
 * `if (!v.collapsed && v.n > v.recommendedN)`.
 */
import type { BestPractice } from "./bestPractices";
import { CHART_KIND_LABEL, type ChartKind } from "./chartKinds";
import type { AuditReport } from "./audit";

export interface ChartWarning {
  severity: "error" | "warn" | "info";
  title: string;
  detail: string;
}

export function buildWarningList(
  k: ChartKind,
  r: BestPractice,
  requested: number,
  rendered: number,
  /** True only when the posture cap actually collapsed slots into "Other"
   *  (chartTheme.overflow) — NOT when N is merely above the solver-safe cap. */
  collapsed: boolean,
  /** True when N exceeds the solver-safe cap for this theme/posture. */
  aboveSafe: boolean,
  safeCap: number,
  a: AuditReport,
  relax: string[]
) {
  const ws: ChartWarning[] = [];
  const w = r.warn?.(rendered) ?? null;
  if (collapsed) {
    ws.push({
      severity: "error",
      title: `N=${requested} exceeds the ${CHART_KIND_LABEL[k]} hard cap of ${r.maxN}`,
      detail: `Slots past ${r.maxN} were collapsed into "Other". Lower N or pick a chart type that supports more series.`,
    });
  }
  if (aboveSafe && !collapsed) {
    ws.push({
      severity: "warn",
      title: `N=${rendered} is above the solver-safe cap of ${safeCap} for this theme`,
      detail: `Up to N=${safeCap} every floor passes with zero relaxations. Above it nothing is collapsed — all ${rendered} slots render — but the solver may relax floors; the entries below show which ones.`,
    });
  }
  if (w) {
    ws.push({
      severity: "warn",
      title: w,
      detail: `${CHART_KIND_LABEL[k]} recommends N ≤ ${r.recommendedN}; rendering ${rendered}.`,
    });
  } else if (rendered > r.recommendedN && !collapsed) {
    ws.push({
      severity: "warn",
      title: `N=${rendered} is above the recommended ${r.recommendedN} for ${CHART_KIND_LABEL[k]}`,
      detail: `Past ${r.recommendedN} slots, dash / decal / shape carry identity rather than color.`,
    });
  }
  for (const v of a.perVision) {
    if (!v.pass) {
      ws.push({
        severity: v.mode === "normal" ? "error" : "warn",
        title: `${v.mode} fails ${v.mode === "achromatopsia" ? "ΔL" : "ΔE"} ≥ ${v.threshold < 1 ? v.threshold.toFixed(1) : v.threshold.toFixed(0)} (got ${v.minDeltaE.toFixed(1)})`,
        detail:
          v.mode === "achromatopsia"
            ? "Two slots collapse to indistinguishable grays — meaning will be lost in print, projector, or grayscale screenshots."
            : v.mode === "normal"
            ? "Two slots are too close even in normal vision. Lower N or change chart type."
            : "Two slots simulate to indistinguishable colors under this CVD type. Dash, decal, and shape still differentiate them, but color alone won't.",
      });
    }
  }
  if (!a.bgPass) {
    ws.push({
      severity: "error",
      title: `Contrast vs. background ${a.worstContrastVsBg.toFixed(2)}:1 fails WCAG 2.2 SC 1.4.11 (≥ 3:1)`,
      detail: "At least one mark color blends into the chart background.",
    });
  }
  for (const rx of relax) {
    ws.push({
      severity: "info",
      title: `Solver relaxed: ${rx}`,
      detail: "The optimizer couldn't satisfy this constraint at the current N and loosened it. Lower N to restore it.",
    });
  }
  return ws;
}
