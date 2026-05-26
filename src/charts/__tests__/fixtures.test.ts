import { describe, it, expect } from "vitest";
import { genLineData, genStackedData, genHeatmap, genDiverging } from "@/charts/fixtures";

describe("fixtures determinism", () => {
  it("genLineData returns identical output for identical inputs", () => {
    expect(genLineData(5, "messy")).toEqual(genLineData(5, "messy"));
    expect(genLineData(3, "synthetic")).toEqual(genLineData(3, "synthetic"));
  });

  it("genStackedData / genHeatmap / genDiverging are deterministic", () => {
    expect(genStackedData(4, "messy")).toEqual(genStackedData(4, "messy"));
    expect(genHeatmap("messy")).toEqual(genHeatmap("messy"));
    expect(genDiverging("messy")).toEqual(genDiverging("messy"));
  });
});

describe("fixtures messy mode characteristics", () => {
  it("genLineData messy includes at least one null (~6% missing)", () => {
    const series = genLineData(4, "messy", 200);
    const hasNull = series.some((s) => s.data.some(([, v]) => v === null));
    expect(hasNull).toBe(true);
  });

  it("genHeatmap messy includes missing cells", () => {
    const { data } = genHeatmap("messy");
    expect(data.some(([, , v]) => v === "-")).toBe(true);
  });

  it("genDiverging messy contains both an extreme high and extreme low", () => {
    const vals = genDiverging("messy").map((d) => d.value);
    expect(Math.max(...vals)).toBeGreaterThan(50);
    expect(Math.min(...vals)).toBeLessThan(-50);
  });
});
