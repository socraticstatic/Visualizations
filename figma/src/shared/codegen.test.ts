import { describe, it, expect } from "vitest";
import { MAX_SLOTS, dashScale, shapeScale } from "@engine/encoding";
import { PALETTE_VERSION } from "@engine/version";
import {
  echartsOption,
  cssTokens,
  paletteJson,
  collectSeries,
  MAX_CODEGEN_NODES,
  type CodegenInput,
} from "./codegen";

const input = (n: number, names?: string[]): CodegenInput => ({
  surface: "#ffffff",
  series: Array.from({ length: n }, (_, i) => ({
    name: names?.[i] ?? `Revenue ${i + 1}`,
    hex: `#${(0x112233 + i * 0x101010).toString(16).padStart(6, "0")}`,
  })),
});

describe("echartsOption", () => {
  it("emits one series per slot with all four channels", () => {
    const out = echartsOption(input(3));
    expect(out.match(/type: "line"/g)).toHaveLength(3);
    expect(out).toContain('symbol: "circle"');
    expect(out).toContain("decal:");
    expect(out).toContain("lineStyle:");
  });

  it("emits solid as a string and dashes as arrays, matching the engine scale", () => {
    const out = echartsOption(input(2));
    expect(out).toContain('type: "solid"');
    expect(out).toContain(`type: [${(dashScale[1] as number[]).join(", ")}]`);
  });

  it("uses the layer name when it carries meaning", () => {
    expect(echartsOption(input(1, ["Net revenue"]))).toContain('name: "Net revenue"');
  });

  it("falls back to a slot label for default Figma layer names", () => {
    for (const junk of ["Rectangle 12", "Ellipse 3", "Frame 400", ""]) {
      expect(echartsOption(input(1, [junk]))).toContain('name: "Series 1"');
    }
  });

  it("carries the engine version so generated code is traceable", () => {
    expect(echartsOption(input(1))).toContain(PALETTE_VERSION);
  });

  it("omits backgroundColor when the surface could not be resolved", () => {
    expect(echartsOption({ series: input(1).series, surface: null })).not.toContain("backgroundColor");
  });

  it("never emits more slots than the encoding scales define", () => {
    const out = echartsOption(input(MAX_SLOTS + 4));
    expect(out.match(/type: "line"/g)).toHaveLength(MAX_SLOTS);
  });

  it("produces no undefined or NaN in its output", () => {
    const out = echartsOption(input(MAX_SLOTS));
    expect(out).not.toMatch(/NaN/);
    expect(out).not.toMatch(/: undefined,\s*$/m);
  });
});

describe("cssTokens", () => {
  it("emits colour, dash and shape per slot", () => {
    const out = cssTokens(input(2));
    expect(out).toContain("--chart-series-1-color:");
    expect(out).toContain("--chart-series-2-dash:");
    expect(out).toContain(`--chart-series-1-shape: ${shapeScale[0]};`);
  });

  it("writes dash none rather than the word solid, which is not a CSS value", () => {
    expect(cssTokens(input(1))).toContain("--chart-series-1-dash: none;");
  });
});

describe("paletteJson", () => {
  it("parses and carries every channel", () => {
    const parsed = JSON.parse(paletteJson(input(3)));
    expect(parsed.version).toBe(PALETTE_VERSION);
    expect(parsed.slots).toHaveLength(3);
    expect(parsed.slots[0]).toMatchObject({ slot: 1, color: expect.any(String), shape: expect.any(String) });
    expect(parsed.slots[0].decal).toBeDefined();
  });
});

describe("collectSeries", () => {
  const filled = (n: number, hex = "#112233") =>
    Array.from({ length: n }, (_, i) => ({ name: `Layer ${i}`, hex }));

  it("keeps document order and does not collapse repeated colours", () => {
    const res = collectSeries([
      { name: "A", hex: "#ff0000" },
      { name: "B", hex: "#00ff00" },
      { name: "C", hex: "#ff0000" },
    ]);
    expect(res.series.map((s) => s.name)).toEqual(["A", "B", "C"]);
    expect(res.tooMany).toBe(false);
  });

  it("caps at the encoding scale length, because past it there is no dash left", () => {
    const res = collectSeries(filled(MAX_SLOTS + 8));
    expect(res.series).toHaveLength(MAX_SLOTS);
    expect(res.found).toBe(MAX_SLOTS + 8);
  });

  it("refuses a pasted chart rather than inventing hundreds of series", () => {
    const res = collectSeries(filled(MAX_CODEGEN_NODES + 1));
    expect(res.tooMany).toBe(true);
    expect(res.series).toEqual([]);
    expect(res.found).toBe(MAX_CODEGEN_NODES + 1);
  });

  it("accepts exactly the cap", () => {
    expect(collectSeries(filled(MAX_CODEGEN_NODES)).tooMany).toBe(false);
  });
});
