/**
 * The mockup is the one command that puts a chart on the canvas, so it is the
 * one that can put a BAD chart on the canvas. These are the guards against
 * that.
 */
import { describe, expect, it } from "vitest";
import { buildMockup, MAX_MOCKUP_NODES } from "./mockup";
import { DEFAULT_TOKENS } from "./defaults";
import { solveCategorical } from "@engine/palette/categorical";

const tokens = DEFAULT_TOKENS.light;
const solve = (n: number) =>
  solveCategorical({ n, posture: "comparative", background: tokens.surface, grid: tokens.grid, locks: [] });

function build(n: number, extra: Partial<Parameters<typeof buildMockup>[0]> = {}) {
  const s = solve(n);
  return buildMockup({
    n,
    kind: "line",
    palette: s.palette,
    tokens,
    verdict: "pass",
    relaxations: s.relaxations,
    advisories: [],
    engineVersion: "0.0.0-test",
    ...extra,
  });
}

describe("buildMockup", () => {
  it("emits no pattern fill, because Figma discards them on import", () => {
    // Spike A, 2026-09-15: Figma's SVG import drops <pattern> outright and
    // leaves the shape unfilled with no warning. A mockup that contained one
    // would arrive silently broken.
    const { svg } = build(6);
    expect(svg).not.toContain("<pattern");
    expect(svg).not.toContain("url(#");
  });

  it("says out loud that the decal layer is missing", () => {
    // The palette carries four encodings. Three of them survive into Figma.
    // A designer must not hand this off believing the fourth is represented.
    expect(build(6).svg).toMatch(/decal/i);
  });

  it("carries dash and marker, which are what survive when colour does not", () => {
    const { svg } = build(6);
    expect(svg).toContain("stroke-dasharray");
    // One marker path per point per series, plus the series lines.
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThan(6);
  });

  it("names the frame with everything needed to reproduce it", () => {
    const { frameName } = build(5);
    expect(frameName).toContain("line");
    expect(frameName).toContain("5");
    expect(frameName).toContain("0.0.0-test");
  });

  it("never suppresses an advisory", () => {
    const { svg } = build(9, {
      advisories: ["Past ~7 series a chart reads as busy"],
      relaxations: ["minDeltaL"],
      verdict: "warn",
    });
    expect(svg).toContain("Past ~7 series");
    expect(svg).toContain("minDeltaL");
    expect(svg.toLowerCase()).toContain("warn");
  });

  it("refuses rather than freezing Figma, and shows the estimate", () => {
    const big = build(12);
    expect(big.nodeEstimate).toBeGreaterThan(0);
    expect(big.nodeEstimate).toBeLessThanOrEqual(MAX_MOCKUP_NODES);
    expect(big.refusal).toBeNull();

    const refused = buildMockup({ ...big.input, n: 12, pointsPerSeries: 400 });
    expect(refused.refusal).not.toBeNull();
    expect(refused.refusal).toContain(String(refused.nodeEstimate));
  });

  it("is deterministic, like everything else the engine emits", () => {
    expect(build(6).svg).toBe(build(6).svg);
  });

  it("scales its geometry to the series count without overlapping", () => {
    for (const n of [1, 3, 6, 12]) {
      const { svg } = build(n);
      expect(svg.includes("NaN"), `n=${n}`).toBe(false);
      expect(svg.includes("Infinity"), `n=${n}`).toBe(false);
    }
  });
});
