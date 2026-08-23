/**
 * Probe the highest N for which the solver produces a palette with ZERO
 * relaxations and full constraint satisfaction, given a (theme, posture).
 *
 * The N slider in ChartsDemo does NOT clamp its max to this value: the slider
 * runs to the kind's recommendedN, shows this probe as the "safe" marker, and
 * values above it surface warnings via the audit panel and OptimalOnlyBadge.
 * Default snaps (kind changes, presets) do stay at or below this cap.
 */
import { getChartTheme, type Theme } from "./echartsTheme";
import type { Posture } from "./constraints";
import { POSTURE } from "./constraints";
import { MAX_SLOTS } from "./encoding";
import { auditPalette } from "./audit";

const cache = new Map<string, number>();

function passesAllConstraints(
  theme: Theme,
  posture: Posture,
  n: number
): boolean {
  const t = getChartTheme(theme, posture, n);
  if (t.overflow) return false;
  if (t.solve.relaxations.length > 0) return false;

  // Certification must match what the user-facing audit enforces. The previous
  // hand-rolled loop checked contrast, normal ΔE, and one CVD severity but
  // OMITTED the achromatopsia (grayscale) gate — so safeMaxN could certify a
  // palette (e.g. two locked anchors that gray to the same value) that the
  // audit then failed, contradicting the "full constraint satisfaction" claim.
  // Defer to auditPalette so the two verdicts can never disagree.
  return auditPalette(t.solve.palette, t.tokens.bg).overall === "pass";
}

/**
 * Largest N (clamped to MAX_SLOTS and the posture cap) for which every
 * accessibility/contrast constraint holds with zero relaxations.
 *
 * The walk scans the FULL [1..upper] range rather than stopping at the first
 * failure: the categorical solver is deterministic but its annealing pass-rate
 * is non-monotone in N (a smaller N can occasionally need a relaxation while a
 * larger N satisfies everything). Returning the highest passing N lets the
 * builder slider reach the full 12-slot cap whenever the solver can actually
 * deliver it, while audit/badge UI still flags any intermediate N that needed
 * a relaxation. Returns at minimum 1.
 */
export function safeMaxN(theme: Theme, posture: Posture): number {
  const key = `${theme}|${posture}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const upper = Math.min(MAX_SLOTS, POSTURE[posture].maxCategorical);
  let best = 1;
  for (let n = 1; n <= upper; n++) {
    if (passesAllConstraints(theme, posture, n)) best = n;
  }
  cache.set(key, best);
  return best;
}

/** Reset between tests or after token edits. */
export function clearSafeMaxNCache() {
  cache.clear();
}
