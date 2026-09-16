import type { ColorRecord } from "@engine/palette/distance";
import { compositeOver, fromFigmaRgb } from "./color";
import type { BackdropLayer, SerializedPaint } from "./protocol";

export type BackgroundRefusal =
  | "empty-chain"
  | "no-opaque-backdrop"
  | "image-backdrop"
  | "gradient-backdrop"
  | "non-normal-blend"
  | "mixed-fills";

export type BackgroundResolution =
  | { ok: true; color: ColorRecord; fromNodeId: string }
  | { ok: false; reason: BackgroundRefusal };

export const BACKGROUND_REFUSAL_COPY: Record<BackgroundRefusal, string> = {
  "empty-chain": "Nothing sits behind this selection, so there is no background to measure against.",
  "no-opaque-backdrop":
    "Every layer behind this selection is see-through, so the background is whatever the canvas shows.",
  "image-backdrop":
    "The backdrop is an image. Contrast against a photograph is not a number this tool can defend.",
  "gradient-backdrop": "The backdrop is a gradient, so there is no single background colour.",
  "non-normal-blend":
    "A layer behind this selection uses a blend mode other than Normal, which changes the colour that reaches the eye.",
  "mixed-fills": "A layer behind this selection has mixed fills, so its background colour is ambiguous.",
};

const firstVisible = (fills: SerializedPaint[]): SerializedPaint | null =>
  fills.find((p) => p.visible) ?? null;

/**
 * Walk outward until a fully opaque backdrop is found, compositing translucent
 * layers on the way. Refuses rather than assuming: an audit against a guessed
 * background is a false accessibility claim, and a palette solved against one is
 * the same claim wearing a different hat.
 *
 * @param chain ancestors of the selection, innermost first.
 */
export function resolveBackground(chain: BackdropLayer[]): BackgroundResolution {
  if (chain.length === 0) return { ok: false, reason: "empty-chain" };

  const pending: Array<{ color: ColorRecord; alpha: number }> = [];

  for (const layer of chain) {
    if (layer.blendMode !== "NORMAL") return { ok: false, reason: "non-normal-blend" };
    if (layer.fills === "mixed") return { ok: false, reason: "mixed-fills" };

    const paint = firstVisible(layer.fills);
    if (!paint) continue;

    if (paint.blendMode !== "NORMAL") return { ok: false, reason: "non-normal-blend" };
    if (paint.kind === "image" || paint.kind === "video") return { ok: false, reason: "image-backdrop" };
    if (paint.kind === "gradient") return { ok: false, reason: "gradient-backdrop" };
    if (paint.kind !== "solid" || !paint.color) return { ok: false, reason: "no-opaque-backdrop" };

    const alpha = paint.opacity * layer.opacity;
    const color = fromFigmaRgb(paint.color);

    if (alpha >= 1) {
      let resolved = color;
      for (let i = pending.length - 1; i >= 0; i--) {
        resolved = compositeOver(pending[i].color, pending[i].alpha, resolved);
      }
      return { ok: true, color: resolved, fromNodeId: layer.nodeId };
    }
    pending.push({ color, alpha });
  }

  return { ok: false, reason: "no-opaque-backdrop" };
}
