/**
 * Sequential and diverging ramps in OKLCH with monotonic L.
 */
import { formatHex, converter, type Oklab } from "culori";
import { oklchToRgb, oklchOf, reduceToSrgb } from "./gamut";
import type { ColorRecord } from "./distance";

const toOklab = converter("oklab");

function rgbToRecord(rgb: { r: number; g: number; b: number }): ColorRecord {
  const lab = toOklab({ mode: "rgb", ...rgb }) as Oklab;
  return {
    hex: formatHex({ mode: "rgb", ...rgb }) ?? "#000000",
    rgb,
    oklab: { l: lab.l ?? 0, a: lab.a ?? 0, b: lab.b ?? 0 },
  };
}

function shortestHueArc(h1: number, h2: number, t: number): number {
  let d = h2 - h1;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (h1 + d * t + 360) % 360;
}

export function sequentialRamp(start: ColorRecord, end: ColorRecord, steps: number): ColorRecord[] {
  const a = oklchOf(start.rgb);
  const b = oklchOf(end.rgb);
  const out: ColorRecord[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const l = a.l + (b.l - a.l) * t; // monotonic by construction
    const c = a.c + (b.c - a.c) * t;
    const h = shortestHueArc(a.h || 0, b.h || 0, t);
    const reduced = reduceToSrgb({ l, c, h });
    out.push(rgbToRecord(oklchToRgb(reduced)));
  }
  return out;
}

export function divergingRamp(
  neg: ColorRecord,
  mid: ColorRecord,
  pos: ColorRecord,
  steps: number
): ColorRecord[] {
  // Symmetric around midpoint; matched ΔL on each arm.
  const half = Math.floor(steps / 2);
  const odd = steps % 2 === 1;
  const negArm = sequentialRamp(neg, mid, half + (odd ? 1 : 0));
  const posArm = sequentialRamp(mid, pos, half + (odd ? 1 : 0));
  // Drop duplicated midpoint when odd.
  return odd ? [...negArm, ...posArm.slice(1)] : [...negArm, ...posArm];
}
