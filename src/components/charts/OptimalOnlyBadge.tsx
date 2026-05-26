import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * OptimalOnlyBadge — at-a-glance indicator showing whether every permutation
 * the builder can currently generate is guaranteed optimal.
 *
 * Guaranteed-optimal mode requires:
 *  - No manual ColorPicker overrides on the active theme(s).
 *  - All N sliders within the runtime-probed safe cap (the builder hard-caps
 *    them, so this is structurally true whenever no overrides exist).
 *
 * When manual overrides are present, optimality is no longer guaranteed and
 * the Verify stage may report warnings — the badge surfaces that fact early.
 */
export interface OptimalOnlyBadgeProps {
  hasManualOverrides: boolean;
  safeCapA: number;
  recommendedA: number;
  safeCapB?: number;
  recommendedB?: number;
  compare?: boolean;
}

export function OptimalOnlyBadge({
  hasManualOverrides,
  safeCapA,
  recommendedA,
  safeCapB,
  recommendedB,
  compare,
}: OptimalOnlyBadgeProps) {
  const optimal = !hasManualOverrides;
  const probedBelowRecA = safeCapA < recommendedA;
  const probedBelowRecB =
    compare && safeCapB !== undefined && recommendedB !== undefined
      ? safeCapB < recommendedB
      : false;
  const probed = probedBelowRecA || probedBelowRecB;

  if (optimal) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-full border border-chart-positive/40 bg-chart-positive/10 px-3 py-1 text-xs font-medium text-chart-positive"
        role="status"
        aria-live="polite"
        title={
          probed
            ? `Optimal-only mode. Solver probe lowered the N cap below the kind's recommended value for the current anchors so every permutation still passes ΔE / CVD / contrast checks with zero relaxations.`
            : `Optimal-only mode. Every (kind, N, theme) permutation reachable from the built-in controls is guaranteed to pass ΔE, CVD, and WCAG 3:1 contrast with zero solver relaxations.`
        }
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        <span>Optimal-only</span>
        {probed && <span className="opacity-70">· probed</span>}
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-chart-warn/40 bg-chart-warn/10 px-3 py-1 text-xs font-medium text-chart-warn"
      role="status"
      aria-live="polite"
      title="Manual ColorPicker overrides are active. The solver no longer guarantees every permutation is optimal — check the Verify stage for ΔE / CVD / contrast warnings."
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      <span>Manual overrides · optimality not guaranteed</span>
    </div>
  );
}
