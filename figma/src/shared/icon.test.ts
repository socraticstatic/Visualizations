/**
 * The mark asserts a contrast floor, so it is tested like any other claim.
 * The first draft failed its own audit at 2.31:1, which is exactly the kind of
 * self-refuting artifact this plugin exists to catch.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fromCss, deltaL } from "@engine/palette/distance";
import { contrastRatio, simulateColor } from "@engine/audit";

const here = fileURLToPath(new URL(".", import.meta.url));
const SVG = readFileSync(resolve(here, "../../brand/icon.svg"), "utf8");

const GROUND = "#14171a";
const SLOTS = ["#ebf2f9", "#a8c7e6", "#659cd2"];

describe("plugin icon", () => {
  it("uses exactly the colours this test audits, so the file cannot drift", () => {
    for (const hex of [GROUND, ...SLOTS]) expect(SVG).toContain(hex);
    const used = SVG.match(/#[0-9a-f]{6}/gi) ?? [];
    expect(new Set(used.map((h) => h.toLowerCase()))).toEqual(
      new Set([GROUND, ...SLOTS].map((h) => h.toLowerCase()))
    );
  });

  it("clears the 3:1 non-text floor on its own ground", () => {
    for (const hex of SLOTS) {
      expect(contrastRatio(fromCss(hex), fromCss(GROUND))).toBeGreaterThanOrEqual(3);
    }
  });

  it("survives greyscale, which is the claim it is making", () => {
    const grey = SLOTS.map((h) => simulateColor(fromCss(h), "achromatopsia"));
    for (let i = 1; i < grey.length; i++) {
      expect(Math.abs(deltaL(grey[i], grey[i - 1]))).toBeGreaterThanOrEqual(0.12);
    }
  });

  it("carries a distinct dash and marker per slot, not colour alone", () => {
    expect((SVG.match(/stroke-dasharray/g) ?? []).length).toBe(2); // slot 1 is solid
    expect(SVG).toContain("<circle");
    expect(SVG).toContain("<polygon");
    expect(SVG).toContain('rx="3"'); // the square marker
  });
});
