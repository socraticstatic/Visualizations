/**
 * Probe the highest N for which the solver produces a palette with ZERO
 * relaxations and full constraint satisfaction, given a (theme, posture).
 *
 * This is how the builder enforces the project rule that built-in controls
 * (kind, N, theme) only generate optimal palettes. The N slider in
 * ChartsDemo clamps its `max` to this value so unreachable-by-construction
 * permutations cannot be picked through default UI.
 */
import { getChartTheme, type Theme } from "./echartsTheme";
import type { Posture } from "./constraints";
import { POSTURE } from "./constraints";
import { MAX_SLOTS } from "./encoding";
import { contrastRatio } from "./audit";
import { deltaE, cvdDeltaE } from "./palette/distance";
import { THRESHOLDS, CVD_SEVERITY } from "./constraints";

const cache = new Map<string, number>();

function passesAllConstraints(
  theme: Theme,
  posture: Posture,
  n: number
): boolean {
  const t = getChartTheme(theme, posture, n);
  if (t.overflow) return false;
  if (t.solve.relaxations.length > 0) return false;

  // Double-check accessibility invariants the solver targets.
  const palette = t.solve.palette;
  for (let i = 0; i < palette.length; i++) {
    if (contrastRatio(palette[i], t.tokens.bg) < 3) return false;
    for (let j = i + 1; j < palette.length; j++) {
      if (deltaE(palette[i], palette[j]) < THRESHOLDS.minDeltaENormal) return false;
      if (cvdDeltaE(palette[i], palette[j], CVD_SEVERITY) < THRESHOLDS.minDeltaECvd) return false;
    }
  }
  return true;
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
