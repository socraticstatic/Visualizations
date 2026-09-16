import { describe, it, expect } from "vitest";
import { extractFills, SKIP_REASON_COPY } from "./fills";
import type { SerializedNode, SerializedPaint } from "./protocol";

const solid = (r: number, g: number, b: number, o = 1): SerializedPaint => ({
  kind: "solid", visible: true, opacity: o, blendMode: "NORMAL", color: { r, g, b },
});
const node = (over: Partial<SerializedNode> = {}): SerializedNode => ({
  id: "n1", name: "Bar", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 0, 0)], ...over,
});

describe("extractFills", () => {
  it("extracts a plain solid fill", () => {
    const [f] = extractFills([node()]);
    expect(f.status).toBe("auditable");
    expect(f.color!.hex).toBe("#ff0000");
    expect(f.alpha).toBe(1);
  });

  it("multiplies paint opacity by node opacity", () => {
    const [f] = extractFills([node({ opacity: 0.5, fills: [solid(1, 0, 0, 0.5)] })]);
    expect(f.alpha).toBeCloseTo(0.25, 6);
  });

  it("emits one entry per gradient stop, never an average", () => {
    const grad: SerializedPaint = {
      kind: "gradient", visible: true, opacity: 1, blendMode: "NORMAL",
      stops: [
        { position: 0, color: { r: 0, g: 0, b: 0 }, alpha: 1 },
        { position: 1, color: { r: 1, g: 1, b: 1 }, alpha: 1 },
      ],
    };
    const out = extractFills([node({ fills: [grad] })]);
    expect(out.map((e) => e.color!.hex)).toEqual(["#000000", "#ffffff"]);
    expect(out.map((e) => e.stopIndex)).toEqual([0, 1]);
  });

  it.each([
    ["image", "image-fill"],
    ["video", "video-fill"],
    ["other", "unknown-fill"],
  ] as const)("refuses a %s fill with a reason and no colour", (kind, reason) => {
    const [f] = extractFills([node({ fills: [{ kind, visible: true, opacity: 1, blendMode: "NORMAL" }] })]);
    expect(f.status).toBe("skipped");
    expect(f.reason).toBe(reason);
    expect(f.color).toBeUndefined();
  });

  it("skips non-normal blends on the paint and on the node", () => {
    expect(extractFills([node({ fills: [{ ...solid(1, 0, 0), blendMode: "MULTIPLY" }] })])[0].reason)
      .toBe("non-normal-blend");
    expect(extractFills([node({ blendMode: "SCREEN" })])[0].reason).toBe("non-normal-blend");
  });

  it("reports hidden, mixed and empty rather than returning nothing", () => {
    expect(extractFills([node({ fills: [{ ...solid(1, 0, 0), visible: false }] })])[0].reason).toBe("hidden");
    expect(extractFills([node({ fills: "mixed" })])[0].reason).toBe("mixed-fills");
    expect(extractFills([node({ fills: [] })])[0].reason).toBe("no-fills");
  });

  it("yields at least one entry for every node in a selection", () => {
    expect(extractFills([node({ fills: [] }), node({ id: "n2", fills: "mixed" })])).toHaveLength(2);
  });

  it("has human copy for every skip reason, with no em dashes", () => {
    for (const copy of Object.values(SKIP_REASON_COPY)) {
      expect(copy).toBeTruthy();
      expect(copy).not.toContain("—");
    }
  });
});
