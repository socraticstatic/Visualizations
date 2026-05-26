import { describe, it, expect } from "vitest";
import { stableAssign } from "@/charts/palette/assignment";
import { sequentialRamp, divergingRamp } from "@/charts/palette/ramps";
import { fromHsl } from "@/charts/palette/distance";
import { dashScale, decalScale, shapeScale } from "@/charts/encoding";

describe("stableAssign", () => {
  it("preserves prior slots when entities remain", () => {
    const prev = new Map([["a", 0], ["b", 1], ["c", 2]]);
    const next = stableAssign(prev, ["a", "b", "c"], 4);
    expect(next.get("a")).toBe(0);
    expect(next.get("b")).toBe(1);
    expect(next.get("c")).toBe(2);
  });
  it("fills new entities into lowest free slots", () => {
    const prev = new Map([["a", 0], ["c", 2]]);
    const next = stableAssign(prev, ["a", "b", "c", "d"], 4);
    expect(next.get("a")).toBe(0);
    expect(next.get("c")).toBe(2);
    expect(next.get("b")).toBe(1);
    expect(next.get("d")).toBe(3);
  });
});

describe("sequentialRamp", () => {
  it("is L-monotonic", () => {
    const a = fromHsl(210, 60, 96);
    const b = fromHsl(222, 80, 30);
    const ramp = sequentialRamp(a, b, 7);
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].oklab.l).toBeLessThanOrEqual(ramp[i - 1].oklab.l + 1e-6);
    }
  });
});

describe("divergingRamp", () => {
  it("returns the requested number of steps", () => {
    const neg = fromHsl(0, 72, 45);
    const mid = fromHsl(210, 20, 96);
    const pos = fromHsl(152, 60, 36);
    expect(divergingRamp(neg, mid, pos, 9)).toHaveLength(9);
    expect(divergingRamp(neg, mid, pos, 8)).toHaveLength(8);
  });
});

describe("aligned encoding scales", () => {
  it("have equal length", () => {
    expect(dashScale.length).toBe(decalScale.length);
    expect(decalScale.length).toBe(shapeScale.length);
  });
});
