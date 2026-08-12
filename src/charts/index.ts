/**
 * Public API for the `chart-color-system` package (MIT — see LICENSE-MIT).
 *
 * This barrel is the contract. Everything re-exported here is supported and
 * versioned by PALETTE_VERSION; anything reachable by deep import is not.
 *
 * The engine is environment-free: it depends only on `culori` and does no
 * DOM work. The single exception is `fromCssVar`, which reads a custom
 * property off a live element and is therefore browser-only.
 */

// --- Color primitives -----------------------------------------------------
export {
  fromCss,
  fromHsl,
  fromCssVar,
  deltaE,
  deltaL,
  cvdDeltaE,
  type ColorRecord,
} from "./palette/distance";

export {
  reduceToSrgb,
  oklchToRgb,
  oklchOf,
  type OklchTriple,
} from "./palette/gamut";

// --- Color-vision deficiency ----------------------------------------------
export { simulateRgb, CVD_TYPES, type CvdType } from "./palette/cvd";

// --- Solvers --------------------------------------------------------------
export {
  solveCategorical,
  type SolveInput,
  type SolveResult,
} from "./palette/categorical";

export { sequentialRamp, divergingRamp } from "./palette/ramps";

export { stableAssign } from "./palette/assignment";

// --- Constraints ----------------------------------------------------------
export {
  POSTURE,
  THRESHOLDS,
  RELAXATION_ORDER,
  CVD_SEVERITY,
  OVERFLOW_LABEL,
  PALETTE_SEED,
  type Posture,
  type PostureConfig,
} from "./constraints";

// --- Redundant (non-color) encodings --------------------------------------
export { dashScale, decalScale, shapeScale, MAX_SLOTS } from "./encoding";

// --- Audit ----------------------------------------------------------------
export {
  auditPalette,
  simulateColor,
  contrastRatio,
  type VisionMode,
  type VisionResult,
  type AuditReport,
} from "./audit";

// --- Version --------------------------------------------------------------
export { PALETTE_VERSION } from "./version";
