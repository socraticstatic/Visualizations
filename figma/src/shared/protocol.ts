import type { FigmaRgb } from "./color";
import type { VariableSpec, WrittenRecord } from "./spec";

export type { VariableSpec, WrittenRecord, Drift } from "./spec";

export type Tab = "generate" | "audit" | "simulate";
export type PaintKind = "solid" | "gradient" | "image" | "video" | "other";

export interface SerializedPaint {
  kind: PaintKind;
  visible: boolean;
  opacity: number;
  blendMode: string;
  color?: FigmaRgb;
  stops?: Array<{ position: number; color: FigmaRgb; alpha: number }>;
}

export interface SerializedNode {
  id: string;
  name: string;
  type: string;
  opacity: number;
  blendMode: string;
  fills: SerializedPaint[] | "mixed";
}

/** One ancestor of the selection, innermost first. */
export interface BackdropLayer {
  nodeId: string;
  nodeName: string;
  opacity: number;
  blendMode: string;
  fills: SerializedPaint[] | "mixed";
}

export interface SelectionPayload {
  nodes: SerializedNode[];
  backdrop: BackdropLayer[];
}

export interface WriteSummary {
  created: number;
  updated: number;
  skipped: number;
  usedFallbackCollection: boolean;
}

export type FailureReason =
  | "no-selection"
  | "background-unresolvable"
  | "storage-unavailable"
  | "figma-error";

export type Request =
  | { id: string; type: "read-selection" }
  | { id: string; type: "read-written-record" }
  | { id: string; type: "write-variables"; specs: VariableSpec[]; confirmedOverwrites: string[] }
  | { id: string; type: "store-get" }
  | { id: string; type: "store-set"; key: string; value: string };

export type Response =
  | { id: string; ok: true; type: "selection"; payload: SelectionPayload }
  | { id: string; ok: true; type: "written-record"; payload: WrittenRecord | null }
  | { id: string; ok: true; type: "variables-written"; payload: WriteSummary }
  | { id: string; ok: true; type: "store"; payload: Record<string, string> }
  | { id: string; ok: true; type: "stored" }
  | { id: string; ok: false; reason: FailureReason; detail: string };

export interface OpenMessage {
  type: "open";
  tab: Tab;
}

/** Pushed without a request whenever the canvas selection changes. */
export interface SelectionPush {
  type: "selection-changed";
  payload: SelectionPayload;
}

export function isFailure(r: Response): r is Extract<Response, { ok: false }> {
  return r.ok === false;
}
