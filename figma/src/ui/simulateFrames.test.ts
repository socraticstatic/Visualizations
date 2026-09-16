import { describe, it, expect } from "vitest";
import { buildFrames } from "./SimulateTab";
import type { SelectionPayload, SerializedPaint } from "../shared/protocol";

const solid = (r: number, g: number, b: number): SerializedPaint => ({
  kind: "solid", visible: true, opacity: 1, blendMode: "NORMAL", color: { r, g, b },
});

const payload = (over: Partial<SelectionPayload> = {}): SelectionPayload => ({
  nodes: [
    { id: "n1", name: "A", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(1, 0, 0)] },
    { id: "n2", name: "B", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [solid(0, 1, 0)] },
  ],
  backdrop: [],
  total: 2,
  truncated: false,
  ...over,
});

describe("buildFrames", () => {
  const frames = buildFrames(payload(), 400);

  it("produces one frame per simulated vision type", () => {
    expect(frames.map((f) => f.label)).toEqual(["Deutan", "Protan", "Tritan", "Mono"]);
  });

  it("offsets each frame so they sit side by side, never overlapping", () => {
    const offsets = frames.map((f) => f.offsetX);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(new Set(offsets).size).toBe(offsets.length);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(400);
  });

  it("carries a replacement for every solid fill of every node", () => {
    for (const f of frames) expect(f.replacements).toHaveLength(2);
  });

  it("actually changes red under deutan", () => {
    const red = frames.find((f) => f.label === "Deutan")!.replacements.find((r) => r.nodeId === "n1")!;
    expect(red.color).not.toEqual({ r: 1, g: 0, b: 0 });
  });

  it("makes mono produce equal channels", () => {
    const c = frames.find((f) => f.label === "Mono")!.replacements[0].color;
    expect(Math.abs(c.r - c.g)).toBeLessThan(1e-3);
    expect(Math.abs(c.g - c.b)).toBeLessThan(1e-3);
  });

  it("skips fills it cannot simulate rather than inventing a colour", () => {
    const img: SerializedPaint = { kind: "image", visible: true, opacity: 1, blendMode: "NORMAL" };
    const frames2 = buildFrames(
      payload({ nodes: [{ id: "n3", name: "Photo", type: "RECTANGLE", opacity: 1, blendMode: "NORMAL", fills: [img] }] }),
      400
    );
    expect(frames2[0].replacements).toEqual([]);
  });

  it("ignores nodes with mixed fills", () => {
    const frames2 = buildFrames(
      payload({ nodes: [{ id: "n4", name: "M", type: "FRAME", opacity: 1, blendMode: "NORMAL", fills: "mixed" }] }),
      400
    );
    expect(frames2[0].replacements).toEqual([]);
  });
});
