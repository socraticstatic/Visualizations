/**
 * Deterministic arithmetic for the solver.
 *
 * Measured 2026-09-16 (docs/spikes/engine-divergence.md): the same bundled
 * bytes produced a different palette in 49 of 64 configurations between Node
 * and JavaScriptCore, and ten configurations disagreed on the accessibility
 * VERDICT - one engine passing a palette another failed. Node and Chrome are
 * both V8 and still disagreed, so this is not an engine-family problem.
 *
 * ECMAScript requires +, -, *, / and Math.sqrt to be correctly rounded, and
 * fixes Math.round/floor/abs exactly. It does NOT require that of Math.exp,
 * Math.pow or Math.cbrt - those are implementation-defined to within an
 * unspecified error. The solver runs an annealer whose acceptance test is a
 * float comparison, so a last-bit difference in any of them flips a branch and
 * the search diverges from there.
 *
 * So everything here is built from the exact operations only. `ln` and `exp`
 * are range-reduced and then evaluated as polynomials; scaling by a power of
 * two is done by repeated multiplication, which is exact. No Math.pow, no
 * Math.exp, no Math.cbrt, no trigonometry.
 */

const LN2 = 0.6931471805599453;

/** 2**k for integer k, by exact doubling rather than Math.pow. */
function pow2(k: number): number {
  let r = 1;
  const n = k < 0 ? -k : k;
  for (let i = 0; i < n; i++) r = k < 0 ? r / 2 : r * 2;
  return r;
}

/**
 * Natural log. Range-reduced to [1,2) by exact halving, then the atanh series,
 * which converges on |t| <= 1/3 fast enough that 15 terms exhaust float64.
 */
export function ln(x: number): number {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  let k = 0;
  let m = x;
  while (m >= 2) {
    m = m / 2;
    k++;
  }
  while (m < 1) {
    m = m * 2;
    k--;
  }
  const t = (m - 1) / (m + 1);
  const t2 = t * t;
  let sum = 0;
  // Descending Horner over the odd terms keeps the ordering fixed.
  for (let i = 29; i >= 1; i -= 2) sum = sum * t2 + 1 / i;
  return 2 * t * sum + k * LN2;
}

/** e**x. Range-reduced so |r| <= ln2/2, then Taylor to 14 terms. */
export function exp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let sum = 0;
  for (let i = 14; i >= 1; i--) sum = (sum + 1) * (r / i);
  return (sum + 1) * pow2(k);
}

/** x**e for x >= 0. Only used with the fixed sRGB gamma exponents. */
export function pow(x: number, e: number): number {
  if (x === 0) return 0;
  return exp(e * ln(x));
}

/**
 * Snap a channel to the 8-bit grid it will be rendered at.
 *
 * This is a correctness fix as much as a determinism one. A ColorRecord used
 * to carry full-precision rgb with an oklab derived from it, while its `hex`
 * was the 8-bit rounding of that rgb - so the record's own distance maths
 * described a colour slightly different from the one it claimed to be and
 * from the one anybody would see. Snapping first makes the record describe
 * the colour it names, and it also absorbs almost every engine difference,
 * since a discrepancy of ~1e-16 cannot move a value across a 1/255 boundary
 * except in a vanishing set.
 */
export function snap8(v: number): number {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(c * 255) / 255;
}

/**
 * Quantise a derived value onto a fixed grid.
 *
 * The oklab conversion still runs a cube root inside culori, so its last bits
 * can differ even from identical input. 1e-6 in OKLab is 1e-4 in the ΔE scale
 * this system uses, which is three orders below the smallest threshold it
 * enforces (minDeltaECvd = 0.1), so nothing measurable is lost.
 */
const Q = 1e6;
export function quantize(v: number): number {
  return Math.round(v * Q) / Q;
}

/** Snap the rgb, quantise the derived lab, in one place. */
export function normalizeRecordParts(
  rgb: { r: number; g: number; b: number },
  lab: { l: number; a: number; b: number }
) {
  return {
    rgb: { r: snap8(rgb.r), g: snap8(rgb.g), b: snap8(rgb.b) },
    oklab: { l: quantize(lab.l), a: quantize(lab.a), b: quantize(lab.b) },
  };
}
