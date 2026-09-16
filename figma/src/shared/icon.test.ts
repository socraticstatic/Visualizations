/**
 * The mark makes a claim: that it shows one colour as four people receive it,
 * legibly. So the claim is tested with the engine that generates it.
 *
 * An earlier mark failed its own contrast audit at 2.31:1. Writing this test
 * before the artifact is what caught it.
 */
import { describe, it, expect } from "vitest";
import { fromCss, deltaE } from "@engine/palette/distance";
import { contrastRatio, simulateColor, type VisionMode } from "@engine/audit";

const GROUND = fromCss("#14171a");
const BASE = "#f20ddf";
const MODES: VisionMode[] = ["normal", "deutan", "protan", "achromatopsia"];

/** Must match VIEWS in scripts/render-brand.py. */
const RENDERED = ["#f20ddf", "#7092da", "#0075e4", "#888888"];

describe("plugin mark", () => {
  it("renders exactly what the engine simulates, so art and audit cannot diverge", () => {
    const derived = MODES.map((m) => simulateColor(fromCss(BASE), m).hex);
    expect(derived).toEqual(RENDERED);
  });

  it("clears the 3:1 non-text floor for every view on its own ground", () => {
    for (const hex of RENDERED) {
      expect(contrastRatio(fromCss(hex), GROUND)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the four views visibly distinct, so the mark has real variety", () => {
    const views = RENDERED.map(fromCss);
    for (let i = 0; i < views.length; i++) {
      for (let j = i + 1; j < views.length; j++) {
        expect(deltaE(views[i], views[j])).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("degrades to grey under total colour blindness, which is the point", () => {
    const mono = fromCss(RENDERED[3]);
    expect(Math.abs(mono.rgb.r - mono.rgb.g)).toBeLessThan(0.01);
  });
});
