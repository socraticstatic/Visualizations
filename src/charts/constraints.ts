/**
 * Chart palette constraints.
 *
 * All ΔE values are in OKLab (Euclidean distance × 100 to be intuitive — values
 * roughly comparable to ΔE2000). Tune these in one place; everything downstream
 * reads from here.
 */

export type Posture = "kpi" | "comparative" | "exploratory";

export interface PostureConfig {
  /** Maximum categorical slots before the system switches to Top-N + Other. */
  maxCategorical: number;
  /** Whether the posture allows full chroma or biases toward muted highlight + gray. */
  chromaBias: "high" | "medium" | "low";
}

export const POSTURE: Record<Posture, PostureConfig> = {
  // kpi posture covers single-metric callouts AND part-to-whole charts
  // (pie, donut, rose, funnel) that need up to 8 distinct low-chroma slots.
  kpi: { maxCategorical: 8, chromaBias: "low" },
  comparative: { maxCategorical: 12, chromaBias: "medium" },
  exploratory: { maxCategorical: 12, chromaBias: "high" },
};

export const THRESHOLDS = {
  /** Minimum pairwise OKLab distance ×100 between categorical slots (normal vision).
   *  Tuned so the builder can guarantee up to 12 fully-encoded slots. Pure color
   *  separation past ~6 hues is impossible to keep safe under CVD; the paired
   *  dash / decal / marker scales (1:1 with slot index) carry the rest. */
  minDeltaENormal: 1,
  /** Minimum pairwise distance after worst-of-three CVD simulation. Color alone
   *  cannot reliably separate 12 hues under simulated dichromacy — the redundant
   *  shape/dash/decal encodings are what keep the chart readable. */
  minDeltaECvd: 0.1,
  /** Minimum lightness spread between any two categorical slots (OKLab L is 0..1). */
  minDeltaL: 0.005,
  /** Minimum distance from any mark color to the chart background. */
  minDeltaEvsBackground: 12,
  /** Minimum distance from any mark color to the gridline color. */
  minDeltaEvsGrid: 4,
  /** Sequential ramp: target ΔE per visible bin. */
  sequentialStepDeltaE: 6,
} as const;

/**
 * Priority ranking for constraint floors, most-acceptable-to-miss first.
 *
 * NOTE: the solver does NOT step through this list loosening constraints —
 * it runs one annealing pass and then reports (in `SolveResult.relaxations`)
 * which floors the final palette missed. This list documents which of those
 * misses are considered least harmful, for humans reading the audit output.
 */
export const RELAXATION_ORDER: Array<keyof typeof THRESHOLDS> = [
  "minDeltaEvsGrid",
  "minDeltaL",
  "minDeltaECvd",
  "minDeltaENormal",
  "minDeltaEvsBackground",
];

/** CVD severity for Machado 2009 matrices, 0..1. */
export const CVD_SEVERITY = 1.0;

/** Overflow rule: anything beyond posture.maxCategorical collapses into "Other". */
export const OVERFLOW_LABEL = "Other";

/** Deterministic seed for the optimizer. */
export const PALETTE_SEED = 0x5eed_c0de;
