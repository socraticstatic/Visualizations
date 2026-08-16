/**
 * Shareable deep-link state for /charts.
 *
 * Serializes the high-level builder inputs (kind, N, theme, vision, compare,
 * variant B) into the URL hash so designers can paste a permalink in a ticket
 * or Slack and the recipient lands on the exact same configuration.
 *
 * Color overrides are intentionally excluded — they live in localStorage
 * (per-user) and would blow out the URL. The link captures the *recipe*, not
 * the brand anchors.
 */
import { CHART_KIND_LABEL, type ChartKind } from "./chartKinds";
import type { Theme } from "./echartsTheme";
import { VISION_MODES, type VisionMode } from "./audit";

/**
 * The four scroll-anchored sections, in reading order.
 *
 * Section position is part of the shareable link so a reviewer can be pointed
 * at the Evidence for a palette, not just the palette. The nav writes this on
 * an explicit click only — scrollspy must never write it, or ordinary
 * scrolling fills the history stack and destroys the back button.
 */
export const SECTION_IDS = ["evidence", "storytell", "reuse", "ship"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface UrlState {
  kind: ChartKind;
  n: number;
  theme: Theme;
  vision: VisionMode;
  compare: boolean;
  kindB: ChartKind;
  nB: number;
  themeB: Theme;
  /** Deep-linked section. Absent means "top of page". */
  section?: SectionId;
}

export function encodeUrlState(s: UrlState): string {
  const p = new URLSearchParams();
  p.set("k", s.kind);
  p.set("n", String(s.n));
  p.set("t", s.theme);
  p.set("v", s.vision);
  if (s.compare) p.set("c", "1");
  p.set("kb", s.kindB);
  p.set("nb", String(s.nB));
  p.set("tb", s.themeB);
  if (s.section) p.set("s", s.section);
  return p.toString();
}

/** A hash is untrusted input — hand-edited, stale, or hostile. Every key is
 *  validated against the real domain; anything invalid is DROPPED (never
 *  defaulted to a different value, never cast through). */
function isChartKind(k: string): k is ChartKind {
  return k in CHART_KIND_LABEL;
}

function parseN(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 24 ? parsed : undefined;
}

export function decodeUrlState(hash: string): Partial<UrlState> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return {};
  const p = new URLSearchParams(raw);
  const out: Partial<UrlState> = {};
  const k = p.get("k");
  // An unknown kind used to be cast straight through and crashed the page on
  // BEST_PRACTICE[kind] lookup — drop the key instead.
  if (k && isChartKind(k)) out.kind = k;
  const n = parseN(p.get("n"));
  if (n !== undefined) out.n = n;
  const t = p.get("t");
  if (t === "light" || t === "dark") out.theme = t;
  const v = p.get("v");
  // An unknown vision mode used to reach the CVD simulator, which silently
  // fell back to the tritan matrix — drop the key instead.
  if (v && (VISION_MODES as readonly string[]).includes(v)) out.vision = v as VisionMode;
  if (p.get("c") === "1") out.compare = true;
  const kb = p.get("kb");
  if (kb && isChartKind(kb)) out.kindB = kb;
  const nb = parseN(p.get("nb"));
  if (nb !== undefined) out.nB = nb;
  const tb = p.get("tb");
  if (tb === "light" || tb === "dark") out.themeB = tb;
  const sec = p.get("s");
  if (sec && (SECTION_IDS as readonly string[]).includes(sec)) out.section = sec as SectionId;
  return out;
}
