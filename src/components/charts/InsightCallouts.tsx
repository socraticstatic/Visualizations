/**
 * Insight callouts — auto-generated plain-English observations about the
 * currently rendered categorical palette. These are *descriptive*, not
 * prescriptive: they surface facts a designer would otherwise have to
 * eyeball ("which slot is most saturated?", "which pair is tightest under
 * CVD?", "what's the dominant hue family?") so the palette's shape is
 * legible at a glance.
 */
import { useMemo } from "react";
import type { ColorRecord } from "@/charts/palette/distance";
import { deltaE, cvdDeltaE } from "@/charts/palette/distance";
import { contrastRatio } from "@/charts/audit";
import { converter, type Oklch } from "culori";

const toOklch = converter("oklch");

function hueFamily(h: number): string {
  // OKLCH hue is 0..360. Rough perceptual labels.
  if (h >= 350 || h < 20) return "red";
  if (h < 50) return "orange";
  if (h < 80) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 250) return "blue";
  if (h < 290) return "purple";
  if (h < 340) return "magenta";
  return "red";
}

interface Insight {
  tone: "info" | "good" | "warn";
  text: string;
}

interface Props {
  colors: ColorRecord[];
  background: ColorRecord;
}

export function InsightCallouts({ colors, background }: Props) {
  const insights = useMemo<Insight[]>(() => {
    if (colors.length === 0) return [];
    const out: Insight[] = [];

    // Chroma analysis — which slot pops?
    const chromas = colors.map((c) => {
      const lch = toOklch(c.hex) as Oklch;
      return { c: lch.c ?? 0, l: lch.l ?? 0, h: lch.h ?? 0 };
    });
    const maxC = chromas.reduce((m, x, i) => (x.c > m.c ? { c: x.c, i } : m), { c: -1, i: 0 });
    const minC = chromas.reduce((m, x, i) => (x.c < m.c ? { c: x.c, i } : m), { c: Infinity, i: 0 });
    const avgC = chromas.reduce((s, x) => s + x.c, 0) / chromas.length;
    if (colors.length >= 2 && maxC.c > avgC * 1.25 && maxC.c > minC.c * 1.4) {
      out.push({
        tone: "info",
        text: `Slot ${maxC.i + 1} is the most saturated (${(maxC.c / avgC).toFixed(2)}× the palette average) — natural pick for a highlight or hero series.`,
      });
    }
    if (colors.length >= 3 && minC.c < avgC * 0.6) {
      out.push({
        tone: "info",
        text: `Slot ${minC.i + 1} is the least saturated — reads as quiet next to the rest. Good "context" slot or use for an "Other" bucket if you don't have one.`,
      });
    }

    // Hue diversity
    const families = new Set(chromas.filter((x) => x.c > 0.02).map((x) => hueFamily(x.h)));
    if (families.size >= 1) {
      const list = Array.from(families).join(" · ");
      out.push({
        tone: families.size >= Math.min(4, colors.length) ? "good" : "info",
        text: `Hue spread: ${families.size} families across ${colors.length} slot${colors.length === 1 ? "" : "s"} (${list}).`,
      });
    }

    // Tightest CVD pair
    if (colors.length >= 2) {
      let worst = { d: Infinity, i: 0, j: 1 };
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const d = cvdDeltaE(colors[i], colors[j]);
          if (d < worst.d) worst = { d, i, j };
        }
      }
      out.push({
        tone: worst.d >= 10 ? "good" : "warn",
        text: `Tightest CVD pair: slots ${worst.i + 1} & ${worst.j + 1} at ΔE ${worst.d.toFixed(1)}${
          worst.d >= 10 ? " — above the safety floor." : " — color alone won't separate them for colorblind viewers; rely on dash/decal/shape."
        }`,
      });

      // Tightest normal-vision pair
      let worstN = { d: Infinity, i: 0, j: 1 };
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const d = deltaE(colors[i], colors[j]);
          if (d < worstN.d) worstN = { d, i, j };
        }
      }
      if (worstN.i !== worst.i || worstN.j !== worst.j) {
        out.push({
          tone: worstN.d >= 18 ? "good" : "warn",
          text: `Tightest normal-vision pair: slots ${worstN.i + 1} & ${worstN.j + 1} at ΔE ${worstN.d.toFixed(1)}.`,
        });
      }
    }

    // Worst contrast vs. bg
    let worstCr = { r: Infinity, i: 0 };
    colors.forEach((c, i) => {
      const r = contrastRatio(c, background);
      if (r < worstCr.r) worstCr = { r, i };
    });
    out.push({
      tone: worstCr.r >= 4.5 ? "good" : worstCr.r >= 3 ? "info" : "warn",
      text: `Tightest contrast vs. background: slot ${worstCr.i + 1} at ${worstCr.r.toFixed(2)}:1${
        worstCr.r >= 4.5
          ? " — comfortable for thin strokes and small marks."
          : worstCr.r >= 3
          ? " — clears WCAG 1.4.11 but tight for 1px lines."
          : " — fails WCAG 1.4.11 (≥ 3:1) for non-text marks."
      }`,
    });

    // Lightness spread
    if (colors.length >= 2) {
      const ls = chromas.map((x) => x.l);
      const spread = Math.max(...ls) - Math.min(...ls);
      out.push({
        tone: spread >= 0.25 ? "good" : spread >= 0.12 ? "info" : "warn",
        text: `Lightness spread: ${(spread * 100).toFixed(0)} points OKLab L${
          spread >= 0.25
            ? " — survives grayscale print well."
            : spread >= 0.12
            ? " — passes the grayscale floor; dash/decal carries the rest."
            : " — risk of slots collapsing in print or projector."
        }`,
      });
    }

    return out;
  }, [colors, background]);

  if (insights.length === 0) return null;

  return (
    <section className="panel p-4 space-y-2">
      <header>
        <h2 className="text-sm font-medium uppercase tracking-wide text-chart-axis">
          Insight callouts
        </h2>
        <p className="text-[11px] text-chart-axis mt-0.5">
          What this palette is shaped like — most saturated slot, tightest pairs, hue spread,
          lightness spread. Descriptive, not prescriptive.
        </p>
      </header>
      <ul className="space-y-1.5 text-sm">
        {insights.map((it, idx) => (
          <li
            key={idx}
            className={`flex gap-2 ${
              it.tone === "warn"
                ? "text-chart-warn"
                : it.tone === "good"
                ? "text-chart-positive"
                : "text-foreground/85"
            }`}
          >
            <span aria-hidden className="font-mono select-none">
              {it.tone === "warn" ? "⚠" : it.tone === "good" ? "✓" : "·"}
            </span>
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
