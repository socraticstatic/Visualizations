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

/**
 * Marker geometry as a single SVG path, so one definition serves every surface
 * that draws a slot.
 *
 * The site's plugin promo and the plugin's own specimen strip each carried
 * their own copy of this table at different radii. Two copies of the shapes
 * that carry identity when colour fails is exactly the drift this system
 * exists to prevent, and the promo is advertising the plugin, so a divergence
 * there would be the site misrepresenting the product.
 *
 * Everything is a path rather than the natural element (circle, rect) so a
 * caller renders one node per marker whatever the shape, and `r` scales the
 * whole thing.
 */
export function markerPathD(slot: number, cx: number, cy: number, r: number): string {
  const n = (v: number) => Number(v.toFixed(3));
  const shape = shapeScale[slot % shapeScale.length];
  switch (shape) {
    case "triangle":
      return `M${n(cx)} ${n(cy - r * 1.06)}L${n(cx + r * 1.06)} ${n(cy + r * 0.81)}L${n(cx - r * 1.06)} ${n(cy + r * 0.81)}Z`;
    case "rect":
      return `M${n(cx - r * 0.94)} ${n(cy - r * 0.94)}H${n(cx + r * 0.94)}V${n(cy + r * 0.94)}H${n(cx - r * 0.94)}Z`;
    case "roundRect": {
      const s = r * 0.94;
      const k = r * 0.56;
      return `M${n(cx - s + k)} ${n(cy - s)}H${n(cx + s - k)}A${n(k)} ${n(k)} 0 0 1 ${n(cx + s)} ${n(cy - s + k)}V${n(cy + s - k)}A${n(k)} ${n(k)} 0 0 1 ${n(cx + s - k)} ${n(cy + s)}H${n(cx - s + k)}A${n(k)} ${n(k)} 0 0 1 ${n(cx - s)} ${n(cy + s - k)}V${n(cy - s + k)}A${n(k)} ${n(k)} 0 0 1 ${n(cx - s + k)} ${n(cy - s)}Z`;
    }
    case "diamond":
      return `M${n(cx)} ${n(cy - r * 1.19)}L${n(cx + r * 1.06)} ${n(cy)}L${n(cx)} ${n(cy + r * 1.19)}L${n(cx - r * 1.06)} ${n(cy)}Z`;
    case "pin":
      return `M${n(cx)} ${n(cy - r * 1.19)}c${n(r * 0.59)} 0 ${n(r * 0.97)} ${n(r * 0.42)} ${n(r * 0.97)} ${n(r * 0.97)} 0 ${n(r * 0.62)}-${n(r * 0.97)} ${n(r * 1.42)}-${n(r * 0.97)} ${n(r * 1.42)}s-${n(r * 0.97)}-${n(r * 0.8)}-${n(r * 0.97)}-${n(r * 1.42)}c0-${n(r * 0.55)} ${n(r * 0.38)}-${n(r * 0.97)} ${n(r * 0.97)}-${n(r * 0.97)}Z`;
    case "arrow":
      return `M${n(cx)} ${n(cy - r * 1.19)}L${n(cx + r * 1.06)} ${n(cy + r * 1.06)}L${n(cx)} ${n(cy + r * 0.5)}L${n(cx - r * 1.06)} ${n(cy + r * 1.06)}Z`;
    case "circle":
    default:
      return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
  }
}
