import type {
  BackdropLayer, PaintKind, SelectionPayload, SerializedNode, SerializedPaint,
} from "../shared/protocol";

type Loose = Record<string, any>;

const PAINT_KIND: Record<string, PaintKind> = {
  SOLID: "solid",
  GRADIENT_LINEAR: "gradient",
  GRADIENT_RADIAL: "gradient",
  GRADIENT_ANGULAR: "gradient",
  GRADIENT_DIAMOND: "gradient",
  IMAGE: "image",
  VIDEO: "video",
};

export function serializePaint(p: unknown): SerializedPaint {
  const q = (p ?? {}) as Loose;
  const kind = PAINT_KIND[q.type as string] ?? "other";
  const out: SerializedPaint = {
    kind,
    visible: q.visible !== false,
    opacity: typeof q.opacity === "number" ? q.opacity : 1,
    blendMode: typeof q.blendMode === "string" ? q.blendMode : "NORMAL",
  };
  if (kind === "solid" && q.color) out.color = { r: q.color.r, g: q.color.g, b: q.color.b };
  if (kind === "gradient" && Array.isArray(q.gradientStops)) {
    out.stops = q.gradientStops.map((s: Loose) => ({
      position: s.position,
      color: { r: s.color.r, g: s.color.g, b: s.color.b },
      alpha: typeof s.color.a === "number" ? s.color.a : 1,
    }));
  }
  return out;
}

function serializeFills(fills: unknown): SerializedPaint[] | "mixed" {
  if (fills === undefined || fills === null) return [];
  if (!Array.isArray(fills)) return "mixed"; // figma.mixed is a unique symbol
  return fills.map(serializePaint);
}

export function serializeNode(n: unknown): SerializedNode {
  const q = (n ?? {}) as Loose;
  return {
    id: q.id,
    name: q.name,
    type: q.type,
    opacity: typeof q.opacity === "number" ? q.opacity : 1,
    blendMode: typeof q.blendMode === "string" ? q.blendMode : "NORMAL",
    fills: serializeFills(q.fills),
  };
}

/** Ancestors innermost first, stopping before PAGE and DOCUMENT. */
export function collectBackdrop(node: unknown): BackdropLayer[] {
  const out: BackdropLayer[] = [];
  let cur = ((node ?? {}) as Loose).parent as Loose | null | undefined;
  while (cur && cur.type !== "PAGE" && cur.type !== "DOCUMENT") {
    out.push({
      nodeId: cur.id,
      nodeName: cur.name,
      opacity: typeof cur.opacity === "number" ? cur.opacity : 1,
      blendMode: typeof cur.blendMode === "string" ? cur.blendMode : "NORMAL",
      fills: serializeFills(cur.fills),
    });
    cur = cur.parent as Loose | null | undefined;
  }
  return out;
}

/** A selection of thousands of nodes is a pasted chart, not a design decision. */
export const MAX_SELECTION_NODES = 400;

export function readSelection(): SelectionPayload {
  const roots = figma.currentPage.selection;
  const nodes: SerializedNode[] = [];
  let total = 0;

  // Counting continues past the cap. Reporting on a prefix while calling it a
  // verdict is the same false claim as auditing against a guessed background,
  // so the panel is told how much it is not seeing.
  const visit = (n: SceneNode) => {
    total++;
    if (nodes.length < MAX_SELECTION_NODES) nodes.push(serializeNode(n));
    const kids = (n as unknown as Loose).children as SceneNode[] | undefined;
    if (Array.isArray(kids)) kids.forEach(visit);
  };
  roots.forEach(visit);

  return {
    nodes,
    backdrop: roots.length > 0 ? collectBackdrop(roots[0]) : [],
    total,
    truncated: total > nodes.length,
  };
}
