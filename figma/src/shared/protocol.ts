import type { FigmaRgb } from "./color";
import type { VariableSpec, WrittenRecord } from "./spec";

export type { VariableSpec, WrittenRecord, Drift } from "./spec";

export type Tab = "generate" | "audit" | "simulate" | "mockup";
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
  /** Nodes actually present, before the read cap. */
  total: number;
  /** True when `nodes` is a prefix of the selection rather than all of it. */
  truncated: boolean;
}

export interface WriteSummary {
  created: number;
  updated: number;
  skipped: number;
  usedFallbackCollection: boolean;
  /** Metadata this Figma client refused, so the panel can say so out loud. */
  unsupported: string[];
}

export interface SimulationSpec {
  mode: string;
  label: string;
  offsetX: number;
  /** Replacement colour per original node id and fill index. */
  replacements: Array<{ nodeId: string; fillIndex: number; color: FigmaRgb }>;
}

export type FailureReason =
  | "no-selection"
  | "unlicensed"
  | "background-unresolvable"
  | "storage-unavailable"
  | "figma-error";

export type Request =
  | { id: string; type: "read-selection" }
  | { id: string; type: "read-command" }
  | { id: string; type: "read-written-record" }
  | { id: string; type: "write-variables"; specs: VariableSpec[]; confirmedOverwrites: string[] }
  | { id: string; type: "render-simulation"; frames: SimulationSpec[] }
  | { id: string; type: "insert-mockup"; svg: string; frameName: string; nodeEstimate: number }
  | { id: string; type: "store-get" }
  | { id: string; type: "store-set"; key: string; value: string };

export type Response =
  | { id: string; ok: true; type: "selection"; payload: SelectionPayload }
  | { id: string; ok: true; type: "command"; payload: Tab }
  | { id: string; ok: true; type: "written-record"; payload: WrittenRecord | null }
  | { id: string; ok: true; type: "variables-written"; payload: WriteSummary }
  | { id: string; ok: true; type: "simulation-rendered"; payload: { created: number } }
  | { id: string; ok: true; type: "mockup-inserted"; payload: { nodes: number; frameName: string } }
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
