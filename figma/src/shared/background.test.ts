import { describe, it, expect } from "vitest";
import { resolveBackground, BACKGROUND_REFUSAL_COPY } from "./background";
import type { BackdropLayer, SerializedPaint } from "./protocol";

const solid = (r: number, g: number, b: number, o = 1): SerializedPaint => ({
  kind: "solid", visible: true, opacity: o, blendMode: "NORMAL", color: { r, g, b },
});
const layer = (over: Partial<BackdropLayer> = {}): BackdropLayer => ({
  nodeId: "f1", nodeName: "Frame", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 1, 1)], ...over,
});

describe("resolveBackground", () => {
  it("refuses an empty chain", () => {
    expect(resolveBackground([])).toEqual({ ok: false, reason: "empty-chain" });
  });

  it("returns the innermost opaque backdrop", () => {
    const r = resolveBackground([layer({ nodeId: "inner", fills: [solid(0, 0, 0)] }), layer({ nodeId: "outer" })]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.color.hex).toBe("#000000");
      expect(r.fromNodeId).toBe("inner");
    }
  });

  it("composites a translucent layer over the opaque one behind it", () => {
    const r = resolveBackground([
      layer({ nodeId: "inner", opacity: 0.5, fills: [solid(0, 0, 0)] }),
      layer({ nodeId: "outer", fills: [solid(1, 1, 1)] }),
    ]);
    expect(r.ok).toBe(true);
    // Snapped to the 8-bit grid it renders at: 0.5 becomes 128/255.
    if (r.ok) expect(Math.abs(r.color.rgb.r - 128 / 255)).toBeLessThan(1e-6);
  });

  it("keeps walking outward past layers with no visible fill", () => {
    const r = resolveBackground([
      layer({ nodeId: "inner", fills: [] }),
      layer({ nodeId: "outer", fills: [solid(0, 1, 0)] }),
    ]);
    expect(r.ok && r.fromNodeId).toBe("outer");
  });

  it("refuses when the chain never reaches something opaque", () => {
    expect(resolveBackground([layer({ opacity: 0.5 }), layer({ nodeId: "o", opacity: 0.5 })]))
      .toEqual({ ok: false, reason: "no-opaque-backdrop" });
  });

  it("refuses image, gradient, blended and mixed backdrops instead of guessing", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    const grad: SerializedPaint = {
      kind: "gradient", visible: true, opacity: 1, blendMode: "NORMAL",
      stops: [{ position: 0, color: { r: 0, g: 0, b: 0 }, alpha: 1 }],
    };
    expect(resolveBackground([layer({ fills: [img] })])).toEqual({ ok: false, reason: "image-backdrop" });
    expect(resolveBackground([layer({ fills: [grad] })])).toEqual({ ok: false, reason: "gradient-backdrop" });
    expect(resolveBackground([layer({ blendMode: "MULTIPLY" })])).toEqual({ ok: false, reason: "non-normal-blend" });
    expect(resolveBackground([layer({ fills: "mixed" })])).toEqual({ ok: false, reason: "mixed-fills" });
  });

  it("has human copy for every refusal, with no em dashes", () => {
    for (const copy of Object.values(BACKGROUND_REFUSAL_COPY)) {
      expect(copy).toBeTruthy();
      expect(copy).not.toContain("—");
    }
  });
});
