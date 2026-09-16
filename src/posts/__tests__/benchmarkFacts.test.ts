import { describe, expect, it } from "vitest";
import FROZEN from "../benchmarkFacts.json";
import { PALETTE_VERSION } from "@/charts/version";
import { BENCHMARKS } from "@/charts/benchmarks";
import { fromCss, deltaE } from "@/charts/palette/distance";
import { contrastRatio, simulateColor, type VisionMode } from "@/charts/audit";

const CVD_MODES: VisionMode[] = ["deutan", "protan", "tritan"];
const minPair = (cs: ReturnType<typeof fromCss>[]) => {
  let m = Infinity;
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++) m = Math.min(m, deltaE(cs[i], cs[j]));
  return m;
};
const worstCvd = (cs: ReturnType<typeof fromCss>[]) =>
  Math.min(...CVD_MODES.map((mode) => minPair(cs.map((c) => simulateColor(c, mode)))));

/**
 * The post publishes these numbers as measurements. They are committed rather
 * than recomputed per reader, so the only way they go stale is an engine bump
 * without a regeneration - which is exactly what this test catches.
 */
describe("frozen benchmark facts", () => {
  it("was measured against the engine version currently shipping", () => {
    expect(FROZEN.engineVersion).toBe(PALETTE_VERSION);
  });

  it("records how and when it was measured", () => {
    expect(FROZEN.measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(FROZEN.measuredWith).toBeTruthy();
  });

  it("carries the six slots the post describes", () => {
    expect(FROZEN.solved6.palette).toHaveLength(6);
    for (const hex of FROZEN.solved6.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("states figures the post's prose can stand behind", () => {
    // Zero failing slots is the post's claim; the WCAG non-text floor is 3:1.
    expect(FROZEN.solved6.worstContrast).toBeGreaterThan(3);
    expect(FROZEN.solved6.worstCvdDeltaE).toBeGreaterThan(0);
    expect(FROZEN.solved6.minPairDeltaE).toBeGreaterThan(FROZEN.solved6.worstCvdDeltaE);
  });

  /**
   * The post claims in prose that the solver's contrast and CVD separation beat
   * every published palette at N=6. The count of palettes it out-spreads is
   * computed at render, but this claim is not, so it is checked here instead of
   * being trusted.
   */
  it("beats all five published palettes on contrast and CVD separation at N=6", () => {
    const white = fromCss("#ffffff");
    for (const bench of BENCHMARKS) {
      const six = bench.hexes.slice(0, 6).map(fromCss);
      const benchWorstContrast = Math.min(...six.map((c) => contrastRatio(c, white)));
      expect(
        FROZEN.solved6.worstContrast,
        `worst contrast should beat ${bench.name}`,
      ).toBeGreaterThan(benchWorstContrast);
      expect(
        FROZEN.solved6.worstCvdDeltaE,
        `worst CVD ΔE should beat ${bench.name}`,
      ).toBeGreaterThan(worstCvd(six));
    }
  });
});
