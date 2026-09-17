import { describe, it, expect } from "vitest";
import { absoluteBox, clearOf, type Box } from "./mockup";
import { spanWidthOf } from "./selection";

/**
 * Both of these shipped broken and were caught on camera rather than in a test.
 *
 * A mockup inserted with nothing selected landed on the viewport centre, which
 * is where the user's work is, and a simulation laid its copies out against a
 * hardcoded 400 so anything wider stacked on itself.
 */

const box = (x: number, y: number, width = 720, height = 440): Box => ({ x, y, width, height });

describe("clearOf", () => {
  it("leaves a position that already clears everything alone", () => {
    expect(clearOf(box(2000, 0), [box(0, 0), box(800, 0)])).toBe(2000);
  });

  it("moves right past a frame it would land on top of", () => {
    // the defect: the proposed x sits inside an existing frame
    expect(clearOf(box(100, 0), [box(0, 0)])).toBe(784); // 0 + 720 + 64
  });

  it("keeps walking when clearing one neighbour lands it on the next", () => {
    const x = clearOf(box(100, 0), [box(0, 0), box(784, 0)]);
    expect(x).toBe(1568); // past both, 784 + 720 + 64
  });

  it("ignores frames on another row", () => {
    expect(clearOf(box(100, 900), [box(0, 0)])).toBe(100);
  });

  it("treats a frame that only touches edges as clear", () => {
    expect(clearOf(box(720, 0), [box(0, 0)])).toBe(720);
  });

  it("terminates on an empty page", () => {
    expect(clearOf(box(42, 7), [])).toBe(42);
  });
});

describe("spanWidthOf", () => {
  it("is zero for an empty selection, so the caller can fall back", () => {
    expect(spanWidthOf([])).toBe(0);
  });

  it("reports a single node's width", () => {
    expect(spanWidthOf([{ x: 10, width: 720 }])).toBe(720);
  });

  it("spans the union of several nodes, not their sum", () => {
    expect(spanWidthOf([{ x: 0, width: 400 }, { x: 300, width: 400 }])).toBe(700);
  });

  it("prefers the absolute bounding box, which is what a rotated node occupies", () => {
    expect(spanWidthOf([{ x: 0, width: 100, absoluteBoundingBox: { x: -20, width: 140 } }])).toBe(140);
  });

  it("skips nodes with no usable geometry rather than producing NaN", () => {
    expect(spanWidthOf([{ name: "no bounds" }, { x: 0, width: 200 }])).toBe(200);
  });
});

describe("the simulate offset, against a real selection width", () => {
  // buildFrames spaces copies at (i + 1) * (width + GAP) with GAP = 40.
  const offsets = (width: number) => [1, 2, 3, 4].map((i) => i * (width + 40));

  it("never places a copy inside the frame before it", () => {
    const width = 720; // the mockup frame this was caught on
    const xs = [0, ...offsets(width)];
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(width);
    }
  });

  it("would have overlapped at the old hardcoded 400", () => {
    const xs = [0, ...offsets(400)];
    const width = 720;
    // the regression, stated as a fact so the fix cannot be quietly reverted
    expect(xs[1] - xs[0]).toBeLessThan(width);
  });
});

/**
 * Caught on camera on 2026-09-17, the same class of defect as the two above.
 *
 * With a layer selected INSIDE a frame, x and width are reported in the
 * parent's space. The mockup is appended to the page, so using those numbers
 * as page coordinates put a 720-wide frame on top of the dashboard the user
 * had just selected inside. `absoluteBox` reads what the node really occupies.
 */
describe("absoluteBox", () => {
  it("prefers the absolute box over the parent-relative one", () => {
    const nested = { x: 52, y: 44, width: 613, height: 300, absoluteBoundingBox: { x: 472, y: 44, width: 613, height: 300 } };
    expect(absoluteBox(nested as never)).toEqual({ x: 472, y: 44, width: 613, height: 300 });
  });

  it("falls back to the local box when Figma gives no absolute one", () => {
    const loose = { x: 10, y: 20, width: 30, height: 40, absoluteBoundingBox: null };
    expect(absoluteBox(loose as never)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it("places a mockup clear of the frame the selection lives in", () => {
    // dashboard on the page at 420 wide 1083; a gridline inside it at local x 52
    const dashboard = box(420, 0, 1083, 821);
    const nested = { x: 52, y: 44, width: 613, height: 0, absoluteBoundingBox: { x: 472, y: 44, width: 613, height: 0 } };
    const abs = absoluteBox(nested as never);
    const proposed = box(Math.round(abs.x + abs.width + 64), Math.round(abs.y));
    expect(clearOf(proposed, [dashboard])).toBe(1567); // 420 + 1083 + 64
  });

  it("would have landed inside the dashboard with the local numbers", () => {
    // the regression, stated as a fact so it cannot be reverted quietly
    const dashboard = box(420, 0, 1083, 821);
    const localOnly = 52 + 613 + 64; // 729, inside 420..1503
    expect(localOnly).toBeGreaterThan(dashboard.x);
    expect(localOnly).toBeLessThan(dashboard.x + dashboard.width);
  });
});
