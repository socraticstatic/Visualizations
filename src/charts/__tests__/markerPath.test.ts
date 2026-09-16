/**
 * One marker definition, drawn the same everywhere.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seedTokens } from "@/test/seedTokens";

// Every test file here that touches the engine seeds first. This one only
// draws markers, but vitest shares module state between files in this config,
// so importing the engine graph unseeded left the solver caches populated from
// empty tokens and broke paletteGolden and explicitNIsHonoured downstream -
// three failures in files this change never touched.
seedTokens();

import { markerPathD, shapeScale, MAX_SLOTS } from "@/charts/encoding";

const ROOT = join(__dirname, "..", "..", "..");

describe("markerPathD", () => {
  it("draws every slot the encoding scale defines", () => {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const d = markerPathD(i, 10, 10, 4);
      expect(d, `slot ${i}`).toMatch(/^M-?[\d.]/);
      expect(d.length, `slot ${i}`).toBeGreaterThan(10);
    }
  });

  it("gives visually distinct shapes to the slots that need them", () => {
    // Identity fails if two slots inside one palette share a marker.
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) seen.add(markerPathD(i, 10, 10, 4));
    expect(seen.size).toBe(7);
  });

  it("scales about the point it is given", () => {
    const small = markerPathD(1, 0, 0, 1);
    const big = markerPathD(1, 0, 0, 2);
    expect(small).not.toBe(big);
    // Doubling r doubles the extent, so the largest magnitude doubles too.
    const mag = (d: string) => Math.max(...(d.match(/-?[\d.]+/g) ?? []).map((v) => Math.abs(Number(v))));
    expect(mag(big)).toBeCloseTo(mag(small) * 2, 2);
  });

  it("is the only marker table in the repo", () => {
    // Both of these used to carry their own copy at different radii.
    for (const f of ["src/components/charts/PluginPromo.tsx", "figma/src/ui/Specimen.tsx"]) {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src, f).toContain("markerPathD");
      expect(src, f).not.toMatch(/const MARKER(?::| =)/);
    }
  });

  it("covers the whole shape scale", () => {
    expect(new Set(shapeScale).size).toBeGreaterThanOrEqual(7);
  });
});
