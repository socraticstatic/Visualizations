import { describe, it, expect } from "vitest";
import { solveCategorical } from "@/charts/palette/categorical";
import { fromHsl, deltaE, cvdDeltaE } from "@/charts/palette/distance";
import { THRESHOLDS, CVD_SEVERITY } from "@/charts/constraints";

const bg = fromHsl(222, 47, 11); // dark surface
const grid = fromHsl(222, 20, 22);

function solve(n: number) {
  return solveCategorical({ n, posture: "exploratory", background: bg, grid, locks: [] });
}

describe("solveCategorical — property tests", () => {
  it("is deterministic across runs (same inputs → same palette)", () => {
    for (const n of [2, 4, 6, 8]) {
      const a = solve(n);
      const b = solve(n);
      expect(a.palette.map((c) => c.hex)).toEqual(b.palette.map((c) => c.hex));
    }
  });

  it("returns exactly N colors for N=2..8", () => {
    for (let n = 2; n <= 8; n++) {
      expect(solve(n).palette).toHaveLength(n);
    }
  });

  it("emits only in-gamut sRGB hex strings", () => {
    const { palette } = solve(8);
    for (const c of palette) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.rgb.r).toBeGreaterThanOrEqual(0);
      expect(c.rgb.r).toBeLessThanOrEqual(1);
      expect(c.rgb.g).toBeGreaterThanOrEqual(0);
      expect(c.rgb.g).toBeLessThanOrEqual(1);
      expect(c.rgb.b).toBeGreaterThanOrEqual(0);
      expect(c.rgb.b).toBeLessThanOrEqual(1);
    }
  });

  it("either satisfies thresholds or reports the corresponding relaxation", () => {
    for (let n = 2; n <= 8; n++) {
      const r = solve(n);
      let minNormal = Infinity;
      let minCvd = Infinity;
      for (let i = 0; i < r.palette.length; i++) {
        for (let j = i + 1; j < r.palette.length; j++) {
          minNormal = Math.min(minNormal, deltaE(r.palette[i], r.palette[j]));
          minCvd = Math.min(minCvd, cvdDeltaE(r.palette[i], r.palette[j], CVD_SEVERITY));
        }
      }
      if (minNormal < THRESHOLDS.minDeltaENormal) {
        expect(r.relaxations).toContain("minDeltaENormal");
      }
      if (minCvd < THRESHOLDS.minDeltaECvd) {
        expect(r.relaxations).toContain("minDeltaECvd");
      }
    }
  });

  it("honors locked anchors verbatim in the leading slots", () => {
    const lock = fromHsl(12, 80, 55);
    const r = solveCategorical({
      n: 5,
      posture: "exploratory",
      background: bg,
      grid,
      locks: [lock],
    });
    expect(r.palette[0].hex).toBe(lock.hex);
    expect(r.palette).toHaveLength(5);
  });
});
