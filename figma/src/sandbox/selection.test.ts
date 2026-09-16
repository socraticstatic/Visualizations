import { describe, it, expect } from "vitest";
import { serializePaint, serializeNode, collectBackdrop } from "./selection";

describe("serializePaint", () => {
  it("maps a SOLID paint and defaults missing fields", () => {
    expect(serializePaint({ type: "SOLID", visible: true, opacity: 0.5, blendMode: "NORMAL", color: { r: 1, g: 0, b: 0 } }))
      .toEqual({ kind: "solid", visible: true, opacity: 0.5, blendMode: "NORMAL", color: { r: 1, g: 0, b: 0 } });
    const bare = serializePaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } });
    expect(bare.visible).toBe(true);
    expect(bare.opacity).toBe(1);
    expect(bare.blendMode).toBe("NORMAL");
  });

  it("maps every gradient type to one kind, carrying stop alpha", () => {
    for (const t of ["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]) {
      const p = serializePaint({
        type: t, visible: true, opacity: 1, blendMode: "NORMAL",
        gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 0.4 } }],
      });
      expect(p.kind).toBe("gradient");
      expect(p.stops).toEqual([{ position: 0, color: { r: 1, g: 1, b: 1 }, alpha: 0.4 }]);
    }
  });

  it("distinguishes image, video and anything unrecognised", () => {
    expect(serializePaint({ type: "IMAGE" }).kind).toBe("image");
    expect(serializePaint({ type: "VIDEO" }).kind).toBe("video");
    expect(serializePaint({ type: "SOMETHING_NEW" }).kind).toBe("other");
  });
});

describe("serializeNode", () => {
  it("flattens fills and reports a symbol fills value as mixed", () => {
    const n = serializeNode({
      id: "1:2", name: "Bar", type: "RECTANGLE", opacity: 0.8, blendMode: "NORMAL",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }],
    });
    expect(n).toMatchObject({ id: "1:2", opacity: 0.8 });
    expect(Array.isArray(n.fills) && n.fills).toHaveLength(1);
    expect(serializeNode({ id: "x", fills: Symbol("mixed") }).fills).toBe("mixed");
    expect(serializeNode({ id: "y" }).fills).toEqual([]);
  });
});

describe("collectBackdrop", () => {
  const page = { id: "0:1", name: "Page 1", type: "PAGE", parent: null };
  const outer = { id: "1:1", name: "Outer", type: "FRAME", opacity: 1, blendMode: "NORMAL", fills: [], parent: page };
  const inner = { id: "1:2", name: "Inner", type: "FRAME", opacity: 1, blendMode: "NORMAL", fills: [], parent: outer };

  it("walks parents innermost first and stops before the page", () => {
    const leaf = { id: "1:3", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [], parent: inner };
    expect(collectBackdrop(leaf).map((l) => l.nodeId)).toEqual(["1:2", "1:1"]);
  });

  it("returns an empty chain for a node parented straight to the page", () => {
    expect(collectBackdrop({ id: "1:9", type: "RECTANGLE", parent: page })).toEqual([]);
  });
});
