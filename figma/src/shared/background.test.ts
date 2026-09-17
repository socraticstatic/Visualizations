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

/**
 * Caught while recording the demo video on 2026-09-17: the plugin refused to
 * measure its own mockup, and every chart inside a frame in a real file, because
 * Figma reports PASS_THROUGH on containers and the check only allowed NORMAL.
 */
describe("PASS_THROUGH is not a blend hazard", () => {
  const solid = (hex: string) => ({
    kind: "solid" as const, visible: true, opacity: 1, blendMode: "NORMAL",
    color: { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 },
  });
  const layer = (blendMode: string, hex: string) => ({
    nodeId: `n-${blendMode}`, blendMode, opacity: 1, fills: [solid(hex)],
  });

  it("resolves through a container that passes blending through", () => {
    const res = resolveBackground([layer("PASS_THROUGH", "#1B1F24") as never]);
    expect(res.ok).toBe(true);
  });

  it("still refuses a real blend mode", () => {
    const res = resolveBackground([layer("MULTIPLY", "#1B1F24") as never]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("non-normal-blend");
  });

  it("accepts a paint that reports no blend mode at all", () => {
    const l = layer("NORMAL", "#1B1F24") as never as { fills: { blendMode?: string }[] };
    delete l.fills[0].blendMode;
    expect(resolveBackground([l as never]).ok).toBe(true);
  });
});
