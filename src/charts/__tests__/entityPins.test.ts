import { describe, it, expect, beforeEach } from "vitest";
import { buildPinPermutation, applyPinsToTheme } from "@/charts/entityPins";
import { setEntityColor, clearEntityColors } from "@/charts/overrides";

beforeEach(() => {
  clearEntityColors();
});

describe("buildPinPermutation", () => {
  it("returns a true permutation when no pins are set", () => {
    const { slots, collisions } = buildPinPermutation(["a", "b", "c"], 3);
    expect(slots).toEqual([0, 1, 2]);
    expect(collisions).toEqual([]);
  });

  it("honors a single pin and fills the rest in order", () => {
    setEntityColor("b", 0);
    const { slots, collisions } = buildPinPermutation(["a", "b", "c"], 3);
    expect(slots[1]).toBe(0); // b → 0
    expect(new Set(slots)).toEqual(new Set([0, 1, 2]));
    expect(collisions).toEqual([]);
  });

  it("bumps later collisions to the next free slot", () => {
    setEntityColor("a", 1);
    setEntityColor("b", 1); // collides with a
    const { slots, collisions } = buildPinPermutation(["a", "b", "c"], 3);
    expect(slots[0]).toBe(1);
    expect(collisions).toContain("b");
    expect(new Set(slots)).toEqual(new Set([0, 1, 2]));
  });

  it("ignores pins outside [0, n)", () => {
    setEntityColor("a", 99);
    const { slots } = buildPinPermutation(["a", "b"], 2);
    expect(new Set(slots)).toEqual(new Set([0, 1]));
  });
});

describe("applyPinsToTheme", () => {
  it("remaps color, dash, decal, and shape together", () => {
    const theme = {
      colorHexes: ["#aaa", "#bbb", "#ccc"],
      dashes: ["solid", "dash", "dot"] as const,
      decals: ["x", "y", "z"] as const,
      shapes: ["circle", "square", "triangle"],
    };
    const out = applyPinsToTheme(theme, [2, 0, 1]);
    expect(out.colorHexes).toEqual(["#ccc", "#aaa", "#bbb"]);
    expect(out.dashes).toEqual(["dot", "solid", "dash"]);
    expect(out.decals).toEqual(["z", "x", "y"]);
    expect(out.shapes).toEqual(["triangle", "circle", "square"]);
  });
});
