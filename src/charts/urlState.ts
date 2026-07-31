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
import type { ChartKind } from "./chartKinds";
import type { Theme } from "./echartsTheme";
import type { VisionMode } from "./audit";

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

export function decodeUrlState(hash: string): Partial<UrlState> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return {};
  const p = new URLSearchParams(raw);
  const out: Partial<UrlState> = {};
  const k = p.get("k");
  if (k) out.kind = k as ChartKind;
  const n = p.get("n");
  if (n) out.n = Number(n);
  const t = p.get("t");
  if (t === "light" || t === "dark") out.theme = t;
  const v = p.get("v");
  if (v) out.vision = v as VisionMode;
  if (p.get("c") === "1") out.compare = true;
  const kb = p.get("kb");
  if (kb) out.kindB = kb as ChartKind;
  const nb = p.get("nb");
  if (nb) out.nB = Number(nb);
  const tb = p.get("tb");
  if (tb === "light" || tb === "dark") out.themeB = tb;
  const sec = p.get("s");
  if (sec && (SECTION_IDS as readonly string[]).includes(sec)) out.section = sec as SectionId;
  return out;
}
