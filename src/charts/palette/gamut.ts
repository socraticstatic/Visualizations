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

export function reduceToSrgb(triple: OklchTriple): OklchTriple {
  const initial: Oklch = { mode: "oklch", l: triple.l, c: triple.c, h: triple.h };
  if (displayable(initial)) return triple;
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
