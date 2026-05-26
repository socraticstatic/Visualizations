/**
 * Distance utilities — all math in OKLab via culori.
 * We multiply Euclidean OKLab distance ×100 so values feel like ΔE2000.
 */
import { converter, formatHex, parse, type Oklab, type Rgb } from "culori";
import { simulateRgb, type CvdType } from "./cvd";

const toOklab = converter("oklab");
const toRgb = converter("rgb");

export interface ColorRecord {
  hex: string;
  rgb: { r: number; g: number; b: number };
  oklab: { l: number; a: number; b: number };
}

export function fromCss(css: string): ColorRecord {
  const parsed = parse(css);
  if (!parsed) throw new Error(`Cannot parse color: ${css}`);
  const lab = toOklab(parsed) as Oklab;
  const rgb = toRgb(parsed) as Rgb;
  return {
    hex: formatHex(parsed) ?? "#000000",
    rgb: { r: rgb.r ?? 0, g: rgb.g ?? 0, b: rgb.b ?? 0 },
    oklab: { l: lab.l ?? 0, a: lab.a ?? 0, b: lab.b ?? 0 },
  };
}

export function fromHsl(h: number, s: number, l: number): ColorRecord {
  return fromCss(`hsl(${h} ${s}% ${l}%)`);
}

/** Read a `hsl(var(--token))` style HSL triple from a CSS variable. */
export function fromCssVar(varName: string, root: HTMLElement = document.documentElement): ColorRecord {
  const raw = getComputedStyle(root).getPropertyValue(varName).trim();
  if (!raw) throw new Error(`CSS var ${varName} is empty`);
  return fromCss(`hsl(${raw})`);
}

export function deltaE(a: ColorRecord, b: ColorRecord): number {
  const dl = a.oklab.l - b.oklab.l;
  const da = a.oklab.a - b.oklab.a;
  const db = a.oklab.b - b.oklab.b;
  return Math.sqrt(dl * dl + da * da + db * db) * 100;
}

export function deltaL(a: ColorRecord, b: ColorRecord): number {
  return Math.abs(a.oklab.l - b.oklab.l);
}

// Per-ColorRecord cache of CVD-projected OKLab coordinates. The solver
// calls `cvdDeltaE` thousands of times against the same ~1700 candidate
// records during annealing; simulating the matrices + converting RGB→OKLab
// for each call dominated the slider commit (~30 s of self-time in the
// browser profile). With this cache each unique (record, type) pair is
// computed exactly once.
type LabTriplet = { l: number; a: number; b: number };
const CVD_CACHE = new WeakMap<ColorRecord, Partial<Record<CvdType, LabTriplet>>>();

function cvdLab(rec: ColorRecord, type: CvdType, severity: number): LabTriplet {
  // Severity is fixed (1.0) project-wide, so caching by type is safe; if
  // that ever changes, key the inner record by severity too.
  let bucket = CVD_CACHE.get(rec);
  if (!bucket) {
    bucket = {};
    CVD_CACHE.set(rec, bucket);
  }
  const hit = bucket[type];
  if (hit) return hit;
  const sim = simulateRgb(rec.rgb, type, severity);
  const lab = toOklab({ mode: "rgb", ...sim }) as Oklab;
  const out: LabTriplet = { l: lab.l ?? 0, a: lab.a ?? 0, b: lab.b ?? 0 };
  bucket[type] = out;
  return out;
}

/** Worst-of-three CVD-projected distance between two colors. */
export function cvdDeltaE(a: ColorRecord, b: ColorRecord, severity = 1): number {
  const types: CvdType[] = ["deutan", "protan", "tritan"];
  let worst = Infinity;
  for (const t of types) {
    const al = cvdLab(a, t, severity);
    const bl = cvdLab(b, t, severity);
    const dl = al.l - bl.l;
    const da = al.a - bl.a;
    const db = al.b - bl.b;
    const d = Math.sqrt(dl * dl + da * da + db * db) * 100;
    if (d < worst) worst = d;
  }
  return worst;
}

