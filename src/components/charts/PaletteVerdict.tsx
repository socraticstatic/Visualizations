/**
 * PaletteVerdict — the single live answer to "is this palette safe?".
 *
 * Replaces BuilderAuditStatus + AuditSummaryCard + the inline
 * AccessibilityHarness. Between them those three printed the same contrast
 * ratio and the same min ΔE in three separate places spread across five
 * screens of scroll, which is what inflated the page to 8 screens and buried
 * everything below it.
 *
 * This component is pinned beside the chart and never scrolls away, so Verify
 * stops being a destination you travel to and becomes a fact you always have.
 *
 * Collapsed: status, WCAG ratio vs background, min ΔE (normal + worst CVD),
 * relaxation count.
 * Expanded: per-mode ΔE for all five simulations.
 */
import { useState } from "react";
import type { AuditReport, VisionMode } from "@/charts/audit";
import { Term } from "./Term";

/**
 * Translate a measured minimum pairwise ΔE into words a human can act on.
 *
 * JND in OKLab x100 is about 2. The configured pass floors sit far below that
 * on purpose, because past ~6 hues the dash / decal / shape encodings carry
 * identity rather than color. So the raw floor reads as nonsense ("≥ 0.1") and
 * the interpretation has to lead. Lifted from AuditSummaryCard.
 */
function deltaEWords(v: number): string {
  if (!Number.isFinite(v)) return "not applicable";
  if (v >= 10) return "clearly distinct";
  if (v >= 2) return "distinguishable";
  return "patterns carry identity";
}

/** Kept verbatim from AccessibilityHarness so the wording does not drift. */
const MODE_LABEL: Record<VisionMode, string> = {
  normal: "Normal",
  deutan: "Deutan · red-green",
  protan: "Protan · red-green",
  tritan: "Tritan · blue-yellow",
  achromatopsia: "Grayscale",
};

/** ΔE is Infinity for ramps by design; never render that at a user. */
function num(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) : "n/a";
}

export function PaletteVerdict({
  audit,
  relaxations,
  label,
  dense = false,
}: {
  audit: AuditReport;
  /** From ChartTheme.solve.relaxations. Not part of AuditReport. */
  relaxations: string[];
  /** "A" / "B" in compare mode; omitted when there is only one config. */
  label?: string;
  /** Compare mode renders two verdicts in a slim bar, with no expansion. */
  dense?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const normal = audit.perVision.find((v) => v.mode === "normal");
  const worstCvd = audit.perVision
    .filter((v) => v.mode !== "normal")
    .reduce((a, b) => (a.minDeltaE <= b.minDeltaE ? a : b));

  const tone =
    audit.overall === "pass"
      ? "text-chart-positive-text"
      : audit.overall === "warn"
        ? "text-chart-target"
        : "text-chart-negative-text";

  const noRelax = relaxations.length === 0;

  return (
    <section
      aria-label={label ? `Palette verdict ${label}` : "Palette verdict"}
      className="rounded-md border border-chart-grid bg-chart-surface px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {label && <span className="font-medium text-foreground">{label}</span>}

        <span className={`font-semibold uppercase tracking-wide ${tone}`}>{audit.overall}</span>

        <span data-testid="verdict-contrast" className="tabular-nums text-chart-muted-text">
          <Term id="WCAG 2.2 SC 1.4.11">WCAG</Term> {audit.worstContrastVsBg.toFixed(2)}:1
          <span className="ml-1 opacity-70">{audit.bgPass ? "" : "needs ≥ 3:1"}</span>
        </span>

        <span data-testid="verdict-min-delta-e" className="tabular-nums text-chart-muted-text">
          <Term id="ΔE (Delta-E)">ΔE</Term> {num(normal?.minDeltaE ?? NaN)}
          <span className="ml-1 opacity-70">{deltaEWords(normal?.minDeltaE ?? NaN)}</span>
          <span className="ml-1">· worst CVD {num(worstCvd.minDeltaE)}</span>
        </span>

        <span
          data-testid="verdict-relaxations"
          className="tabular-nums text-chart-muted-text"
          title={noRelax ? "all constraints satisfied" : relaxations.join(", ")}
        >
          <Term id="Relaxation">relaxations</Term> {noRelax ? "none" : relaxations.join(", ")}
        </span>

        {!dense && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="tap-target ml-auto rounded border border-chart-grid px-2 text-chart-muted-text transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
          >
            {open ? "Hide detail" : "Detail"}
          </button>
        )}
      </div>

      {open && (
        <dl
          data-testid="verdict-modes"
          className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-chart-grid pt-2 text-[11px] sm:grid-cols-5"
        >
          {audit.perVision.map((v) => (
            <div key={v.mode}>
              <dt className="uppercase tracking-wide text-chart-muted-text">
                {MODE_LABEL[v.mode]}
              </dt>
              <dd
                className={`tabular-nums ${v.pass ? "text-foreground" : "text-chart-negative-text"}`}
              >
                {num(v.minDeltaE)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
