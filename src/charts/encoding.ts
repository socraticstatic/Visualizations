/**
 * Aligned encoding scales — color slot N is always the same dash, decal, and
 * marker shape. This is the core mechanism that keeps charts readable when
 * color alone fails (CVD, grayscale, projector, screenshot).
 */

/** ECharts-compatible dash arrays; first entry is `solid`. */
export const dashScale: Array<"solid" | number[]> = [
  "solid",
  [6, 3],
  [2, 3],
  [10, 3, 2, 3],
  [8, 4],
  [1, 3],
  [12, 3],
  [4, 2, 1, 2],
  [6, 6],
  [3, 1],
  [10, 5, 2, 5],
  [2, 2],
];

/** ECharts decal symbols for bar/area fills. */
export const decalScale: Array<{ symbol: string; rotation: number; symbolSize: number; dashArrayX?: number[]; dashArrayY?: number[] }> = [
  { symbol: "none", rotation: 0, symbolSize: 1 },
  { symbol: "rect", rotation: Math.PI / 4, symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 5] },
  { symbol: "circle", rotation: 0, symbolSize: 1 },
  { symbol: "rect", rotation: -Math.PI / 4, symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 5] },
  { symbol: "triangle", rotation: 0, symbolSize: 2 },
  { symbol: "rect", rotation: 0, symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 4] },
  { symbol: "rect", rotation: Math.PI / 2, symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 4] },
  { symbol: "diamond", rotation: 0, symbolSize: 2 },
  { symbol: "circle", rotation: 0, symbolSize: 2 },
  { symbol: "rect", rotation: Math.PI / 4, symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [4, 4] },
  { symbol: "triangle", rotation: Math.PI, symbolSize: 2 },
  { symbol: "rect", rotation: -Math.PI / 4, symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [4, 4] },
];

/** ECharts symbol names for scatter / line markers. */
export const shapeScale: string[] = [
  "circle",
  "triangle",
  "rect",
  "diamond",
  "pin",
  "arrow",
  "roundRect",
  "circle",
  "triangle",
  "rect",
  "diamond",
  "pin",
];

export const MAX_SLOTS = Math.min(dashScale.length, decalScale.length, shapeScale.length);
