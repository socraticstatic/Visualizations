/**
 * Gamut mapping into sRGB via chroma reduction in OKLCH.
 * Avoids the desaturation/hue-shift artifacts of naive RGB clipping.
 */
import { converter, displayable, type Oklch } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

export interface OklchTriple {
  l: number;
  c: number;
  h: number;
}

// culori's displayable() is exact: a valid sRGB color whose OKLCH roundtrip
// lands a hair outside [0,1] (pure blue #0000ff comes back at r = -9.3e-15) is
// judged out of gamut, and the chroma search below then visibly rewrites it
// (#0000ff -> #0031e5, ΔE 4.76). Treat colors that are out of gamut only by
// floating-point noise as in-gamut, so an already-displayable token is kept as
// authored. Genuinely out-of-gamut colors still fall through to reduction.
const GAMUT_EPS = 1e-4;
function inGamutWithinEps(o: Oklch): boolean {
  const rgb = toRgb(o);
  if (!rgb) return false;
  return (
    rgb.r >= -GAMUT_EPS && rgb.r <= 1 + GAMUT_EPS &&
    rgb.g >= -GAMUT_EPS && rgb.g <= 1 + GAMUT_EPS &&
    rgb.b >= -GAMUT_EPS && rgb.b <= 1 + GAMUT_EPS
  );
}

export function reduceToSrgb(triple: OklchTriple): OklchTriple {
  const initial: Oklch = { mode: "oklch", l: triple.l, c: triple.c, h: triple.h };
  if (inGamutWithinEps(initial)) return triple;
  let lo = 0;
  let hi = triple.c;
  // Binary search for the largest chroma that is in-gamut.
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const test: Oklch = { mode: "oklch", l: triple.l, c: mid, h: triple.h };
    if (displayable(test)) lo = mid;
    else hi = mid;
  }
  return { l: triple.l, c: lo, h: triple.h };
}

export function oklchToRgb(triple: OklchTriple) {
  const reduced = reduceToSrgb(triple);
  const rgb = toRgb({ mode: "oklch", l: reduced.l, c: reduced.c, h: reduced.h });
  return { r: rgb?.r ?? 0, g: rgb?.g ?? 0, b: rgb?.b ?? 0 };
}

export function oklchOf(rgb: { r: number; g: number; b: number }): OklchTriple {
  const c = toOklch({ mode: "rgb", ...rgb }) as Oklch;
  return { l: c.l ?? 0, c: c.c ?? 0, h: c.h ?? 0 };
}
