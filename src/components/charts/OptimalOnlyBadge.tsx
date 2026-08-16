import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * OptimalOnlyBadge — at-a-glance indicator for the CURRENT configuration.
 *
 * Green requires all of:
 *  - No manual ColorPicker overrides on the active theme(s).
 *  - Every active N slider at or below the runtime-probed solver-safe cap
 *    (the slider allows values above it so users can explore warnings).
 *  - Zero solver relaxations in the current solve(s).
 *
 * Anything else gets an amber badge naming the reason, and the Verify stage
 * carries the detail.
 */
export interface OptimalOnlyBadgeProps {
  hasManualOverrides: boolean;
  safeCapA: number;
  recommendedA: number;
  /** Current rendered N for the primary builder. */
  nA: number;
  /** Solver relaxations from the primary builder's current solve. */
  relaxationsA: string[];
  safeCapB?: number;
  recommendedB?: number;
  nB?: number;
  relaxationsB?: string[];
  compare?: boolean;
}

export function OptimalOnlyBadge({
  hasManualOverrides,
  safeCapA,
  recommendedA,
  nA,
  relaxationsA,
  safeCapB,
  recommendedB,
  nB,
  relaxationsB,
  compare,
}: OptimalOnlyBadgeProps) {
  const withinCapA = nA <= safeCapA;
  const noRelaxA = relaxationsA.length === 0;
  const bActive = Boolean(compare) && safeCapB !== undefined && nB !== undefined;
  const withinCapB = !bActive || (nB as number) <= (safeCapB as number);
  const noRelaxB = !bActive || (relaxationsB ?? []).length === 0;

  const optimal = !hasManualOverrides && withinCapA && noRelaxA && withinCapB && noRelaxB;

  const probedBelowRecA = safeCapA < recommendedA;
  const probedBelowRecB =
    bActive && recommendedB !== undefined ? (safeCapB as number) < recommendedB : false;
  const probed = probedBelowRecA || probedBelowRecB;

  if (optimal) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-full border border-chart-positive/40 bg-chart-positive/10 px-3 py-1 text-xs font-medium text-chart-positive-text"
        role="status"
        aria-live="polite"
        title={
          probed
            ? `This configuration passed every check: no manual overrides, N within the solver-safe cap, and zero solver relaxations. The runtime probe lowered the safe cap below the kind's recommended N for the current tokens.`
            : `This configuration passed every check: no manual overrides, N within the solver-safe cap, and the current solve cleared the configured ΔE and CVD floors and WCAG 3:1 contrast with zero relaxations. At high N the dash / decal / shape encodings, not color alone, carry series identity.`
        }
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        <span>Optimal-only</span>
        {probed && <span className="opacity-70">· probed</span>}
      </div>
    );
  }

  const reasons: string[] = [];
  if (hasManualOverrides) reasons.push("manual ColorPicker overrides are active");
  if (!withinCapA) reasons.push(`N=${nA} is above the solver-safe cap of ${safeCapA}`);
  if (!noRelaxA) reasons.push(`the solver relaxed ${relaxationsA.join(", ")}`);
  if (!withinCapB) reasons.push(`Variant B N=${nB} is above its solver-safe cap of ${safeCapB}`);
  if (!noRelaxB) reasons.push(`Variant B's solver relaxed ${(relaxationsB ?? []).join(", ")}`);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-chart-warn/40 bg-chart-warn/10 px-3 py-1 text-xs font-medium text-chart-warn-text"
      role="status"
      aria-live="polite"
      title={`Optimality is not guaranteed for the current configuration: ${reasons.join("; ")}. Check the Verify stage for the exact ΔE / CVD / contrast findings.`}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      <span>
        {hasManualOverrides
          ? "Manual overrides · optimality not guaranteed"
          : "Above safe limits · optimality not guaranteed"}
      </span>
    </div>
  );
}
