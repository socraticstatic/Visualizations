/**
 * A chart mockup as an SVG string, authored here rather than rendered by a
 * charting library.
 *
 * Two reasons. Figma's SVG import discards `<pattern>` fills outright and
 * leaves the shape unfilled with no warning (Spike A, 2026-09-15), so the
 * safest way to guarantee a mockup contains none is to never be in a position
 * to emit one. And a charting runtime would multiply this plugin's bundle
 * several times over for output that is thrown away after one import.
 *
 * What survives into Figma is colour, dash and marker. Decal does not, and
 * every mockup says so on its face - a designer must not hand this to someone
 * believing all four encodings are represented.
 */
import type { ColorRecord } from "@engine/palette/distance";
import { dashScale, markerPathD } from "@engine/encoding";
import type { ChromeTokens } from "./defaults";

/**
 * Figma creates one node per SVG element. A line chart at 12 series and 400
 * points is nearly five thousand nodes, placed synchronously, which locks the
 * editor. Refuse and show the number instead.
 */
export const MAX_MOCKUP_NODES = 1200;

const W = 720;
const H = 440;
const PAD = { top: 56, right: 28, bottom: 44, left: 52 };

export interface MockupInput {
  n: number;
  kind: string;
  palette: ColorRecord[];
  tokens: ChromeTokens;
  verdict: string;
  relaxations: string[];
  advisories: string[];
  engineVersion: string;
  pointsPerSeries?: number;
}

export interface Mockup {
  svg: string;
  frameName: string;
  nodeEstimate: number;
  /** Non-null when the mockup was not built because it would be too large. */
  refusal: string | null;
  input: MockupInput;
}

/** Same integer PRNG the engine uses; exact on every JavaScript engine. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 1831565813) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (v: number) => Number(v.toFixed(2));

export function buildMockup(input: MockupInput): Mockup {
  const points = input.pointsPerSeries ?? 12;
  const n = Math.max(1, Math.min(input.n, input.palette.length));
  const t = input.tokens;

  // 1 line + `points` markers per series, plus axes, gridlines and labels.
  const nodeEstimate = n * (1 + points) + 14;
  const frameName =
    `${input.kind} · N=${n} · ${input.verdict} · engine ${input.engineVersion}`;

  if (nodeEstimate > MAX_MOCKUP_NODES) {
    return {
      svg: "",
      frameName,
      nodeEstimate,
      refusal:
        `This mockup would create about ${nodeEstimate} nodes, over the ${MAX_MOCKUP_NODES} ceiling. ` +
        `Figma places them synchronously, so the editor would lock. Lower N or the point count.`,
      input,
    };
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points === 1 ? plotW / 2 : (i / (points - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - v * plotH;

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${t.surface.hex}"/>`);

  // Gridlines and axes.
  for (let g = 0; g <= 4; g++) {
    const gy = num(PAD.top + (g / 4) * plotH);
    parts.push(
      `<line x1="${PAD.left}" y1="${gy}" x2="${num(PAD.left + plotW)}" y2="${gy}" stroke="${t.grid.hex}" stroke-width="1"/>`
    );
  }
  parts.push(
    `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${num(PAD.top + plotH)}" stroke="${t.axis.hex}" stroke-width="1"/>`
  );

  // Series. Deterministic shapes, distinct enough to read as separate lines.
  for (let s = 0; s < n; s++) {
    const colour = input.palette[s].hex;
    const dash = dashScale[s % dashScale.length];
    const r = rng(0x5eed + s * 977);
    // Series occupy distinct bands. The first attempt gave every series the
    // same wave amplitude around a narrow base spread, so they converged into
    // spaghetti at the left edge - a mockup of an unreadable chart, which is
    // the opposite of the point. The band is wide, the wave is small enough
    // not to cross it, and the jitter is smaller still.
    const band = (s + 0.5) / n;
    const vals = Array.from({ length: points }, (_, i) => {
      const base = 0.08 + band * 0.84;
      const wave = 0.055 * Math.sin((i + s * 1.7) / 2.2);
      return Math.max(0.04, Math.min(0.96, base + wave + (r() - 0.5) * 0.03));
    });
    const d = vals.map((v, i) => `${i === 0 ? "M" : "L"}${num(x(i))} ${num(y(v))}`).join("");
    parts.push(
      `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"` +
        (dash === "solid" ? "" : ` stroke-dasharray="${dash.join(" ")}"`) +
        `/>`
    );
    for (let i = 0; i < points; i++) {
      parts.push(`<path d="${markerPathD(s, x(i), y(vals[i]), 3.6)}" fill="${colour}"/>`);
    }
  }

  // The header states what this is, and the footer states what is missing and
  // what the audit said. Neither is suppressible.
  const title = `${input.kind} · ${n} series · ${input.verdict.toUpperCase()}`;
  parts.push(
    `<text x="${PAD.left}" y="28" font-family="Inter, sans-serif" font-size="15" font-weight="600" fill="${t.label.hex}">${esc(title)}</text>`
  );

  const notes: string[] = [
    "Decal is not rendered: Figma discards pattern fills on SVG import. Colour, dash and marker carry identity here.",
  ];
  if (input.relaxations.length) notes.push(`Relaxed to reach N=${n}: ${input.relaxations.join(", ")}.`);
  for (const a of input.advisories) notes.push(a);

  notes.forEach((note, i) => {
    parts.push(
      `<text x="${PAD.left}" y="${num(H - 26 + i * 13)}" font-family="Inter, sans-serif" font-size="10" fill="${t.axis.hex}">${esc(note)}</text>`
    );
  });

  const height = H + Math.max(0, notes.length - 1) * 13;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">` +
    parts.join("") +
    `</svg>`;

  return { svg, frameName, nodeEstimate, refusal: null, input };
}
