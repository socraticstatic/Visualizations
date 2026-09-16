import { describe, it, expect } from "vitest";
import { fromCss } from "@engine/palette/distance";
import { MAX_SLOTS, shapeScale } from "@engine/encoding";
import { buildVariableSpec, recordFromSpecs, diffWritten, formatDash, describeDecal, type ThemeInput } from "./spec";

const theme = (n: number, base: "light" | "dark"): ThemeInput => ({
  palette: Array.from({ length: n }, (_, i) =>
    fromCss(`hsl(${(i * 31) % 360} 60% ${base === "light" ? 40 : 70}%)`)
  ),
  surface: fromCss(base === "light" ? "#ffffff" : "#111111"),
  grid: fromCss("#888888"),
  axis: fromCss("#666666"),
  label: fromCss(base === "light" ? "#222222" : "#eeeeee"),
});

const build = (n: number) => buildVariableSpec({ light: theme(n, "light"), dark: theme(n, "dark") });

describe("formatDash / describeDecal", () => {
  it("renders dashes a designer can retype", () => {
    expect(formatDash("solid")).toBe("solid");
    expect(formatDash([6, 3])).toBe("6 3");
  });

  it("names decals in words rather than radians", () => {
    expect(describeDecal({ symbol: "none", rotation: 0, symbolSize: 1 })).toBe("none");
    expect(describeDecal({ symbol: "rect", rotation: 0, symbolSize: 1 })).toBe("horizontal lines");
    expect(describeDecal({ symbol: "rect", rotation: Math.PI / 4, symbolSize: 1 })).toBe("diagonal lines 45 deg");
    expect(describeDecal({ symbol: "circle", rotation: 0, symbolSize: 1 })).toBe("circles");
  });
});

describe("buildVariableSpec", () => {
  const specs = build(4);
  const names = specs.map((s) => s.name);

  it("emits four variables per slot plus four chrome tokens", () => {
    for (let i = 1; i <= 4; i++) {
      for (const suffix of ["color", "dash", "decal", "shape"]) {
        expect(names).toContain(`chart/series/${i}/${suffix}`);
      }
    }
    for (const t of ["surface", "grid", "axis", "label"]) expect(names).toContain(`chart/${t}`);
  });

  it("types colours COLOR and encodings STRING", () => {
    expect(specs.find((s) => s.name === "chart/series/1/color")!.kind).toBe("COLOR");
    expect(specs.find((s) => s.name === "chart/series/1/dash")!.kind).toBe("STRING");
  });

  it("gives every variable a code syntax name for Dev Mode handoff", () => {
    expect(specs.find((s) => s.name === "chart/series/2/color")!.codeSyntax).toBe("chart.series2.color");
    for (const s of specs) expect(s.codeSyntax).toMatch(/^chart\.[A-Za-z0-9.]+$/);
  });

  it("scopes colours to fills and strokes so they stay out of unrelated pickers", () => {
    const c = specs.find((s) => s.name === "chart/surface")!;
    expect(c.scopes).toEqual(["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"]);
    expect(c.scopes).not.toContain("STROKE");
  });

  it("uses the same encoding value in both modes and different colours", () => {
    const dash = specs.find((s) => s.name === "chart/series/2/dash")!;
    expect(dash.light).toBe(dash.dark);
    const surface = specs.find((s) => s.name === "chart/surface")!;
    expect(surface.light).not.toEqual(surface.dark);
  });

  it("matches the engine's shape scale", () => {
    expect(specs.find((s) => s.name === "chart/series/1/shape")!.light).toBe(shapeScale[0]);
  });

  it("throws when the modes disagree on slot count", () => {
    expect(() => buildVariableSpec({ light: theme(3, "light"), dark: theme(4, "dark") })).toThrow(/slot count/i);
  });

  it("never emits more slots than the encoding scales define", () => {
    const big = build(MAX_SLOTS + 5);
    expect(big.filter((s) => s.name.endsWith("/color") && s.name.startsWith("chart/series/"))).toHaveLength(MAX_SLOTS);
  });
});

describe("diffWritten", () => {
  const recorded = recordFromSpecs(build(2));

  it("reports nothing when nothing changed", () => {
    expect(diffWritten(recorded, recorded)).toEqual([]);
  });

  it("reports a hand edit in one mode only", () => {
    const current = structuredClone(recorded);
    current["chart/series/1/color"].light = "0.1,0.2,0.3";
    const drift = diffWritten(recorded, current);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ name: "chart/series/1/color", mode: "light" });
  });

  it("ignores variables the plugin never wrote, and ones since deleted", () => {
    const withExtra = { ...structuredClone(recorded), "someone/else": { light: "x", dark: "y" } };
    expect(diffWritten(recorded, withExtra)).toEqual([]);
    const missing = structuredClone(recorded);
    delete missing["chart/series/1/dash"];
    expect(diffWritten(recorded, missing)).toEqual([]);
  });
});
