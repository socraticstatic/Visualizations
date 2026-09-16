import type { ColorRecord } from "@engine/palette/distance";
import { fromFigmaRgb } from "./color";
import type { SerializedNode, SerializedPaint } from "./protocol";

export type SkipReason =
  | "hidden"
  | "mixed-fills"
  | "no-fills"
  | "image-fill"
  | "video-fill"
  | "unknown-fill"
  | "non-normal-blend";

export interface ExtractedFill {
  nodeId: string;
  nodeName: string;
  status: "auditable" | "skipped";
  source: "solid" | "gradient-stop";
  color?: ColorRecord;
  /** Paint opacity multiplied by node opacity. */
  alpha?: number;
  stopIndex?: number;
  reason?: SkipReason;
}

export const SKIP_REASON_COPY: Record<SkipReason, string> = {
  hidden: "Hidden, so it is not on screen to measure.",
  "mixed-fills": "Mixed fills, so there is no single colour to measure.",
  "no-fills": "No fill at all.",
  "image-fill": "Image fill. Contrast against a photograph is not a number this tool can defend.",
  "video-fill": "Video fill, and its colour changes frame to frame.",
  "unknown-fill": "Figma reported a paint type this plugin does not recognise.",
  "non-normal-blend": "A blend mode other than Normal changes the colour that reaches the eye.",
};

const skip = (n: SerializedNode, reason: SkipReason): ExtractedFill => ({
  nodeId: n.id,
  nodeName: n.name,
  status: "skipped",
  source: "solid",
  reason,
});

function fromPaint(n: SerializedNode, p: SerializedPaint): ExtractedFill[] {
  if (!p.visible) return [skip(n, "hidden")];
  if (p.blendMode !== "NORMAL") return [skip(n, "non-normal-blend")];

  if (p.kind === "solid" && p.color) {
    return [
      {
        nodeId: n.id,
        nodeName: n.name,
        status: "auditable",
        source: "solid",
        color: fromFigmaRgb(p.color),
        alpha: p.opacity * n.opacity,
      },
    ];
  }

  if (p.kind === "gradient" && p.stops) {
    // Each stop on its own. Averaging a gradient reports a contrast that exists
    // nowhere on the shape.
    return p.stops.map((s, i) => ({
      nodeId: n.id,
      nodeName: n.name,
      status: "auditable" as const,
      source: "gradient-stop" as const,
      color: fromFigmaRgb(s.color),
      alpha: s.alpha * p.opacity * n.opacity,
      stopIndex: i,
    }));
  }

  if (p.kind === "image") return [skip(n, "image-fill")];
  if (p.kind === "video") return [skip(n, "video-fill")];
  return [skip(n, "unknown-fill")];
}

/**
 * Every node yields at least one entry, so the panel can always say what was
 * found and why it was skipped rather than reporting nothing.
 */
export function extractFills(nodes: SerializedNode[]): ExtractedFill[] {
  const out: ExtractedFill[] = [];
  for (const n of nodes) {
    if (n.blendMode !== "NORMAL") {
      out.push(skip(n, "non-normal-blend"));
      continue;
    }
    if (n.fills === "mixed") {
      out.push(skip(n, "mixed-fills"));
      continue;
    }
    if (n.fills.length === 0) {
      out.push(skip(n, "no-fills"));
      continue;
    }
    for (const p of n.fills) out.push(...fromPaint(n, p));
  }
  return out;
}
