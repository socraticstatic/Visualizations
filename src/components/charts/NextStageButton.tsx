/**
 * NextStageButton — the linear path through the four sections.
 *
 * A first-timer sets the controls then walks Evidence → Storytell → Reuse →
 * Ship without ever choosing where to go. A returning user ignores this and
 * clicks any pill in SectionNav. Neither is trapped in the other's model.
 *
 * Previously keyed off FlowStepper's seven ids, which pointed at `flow-*`
 * anchors that no longer exist, so every one of these buttons scrolled
 * nowhere. Typing `current` as SectionId means that cannot recur silently.
 */
import { SECTION_IDS, type SectionId } from "@/charts/urlState";
import { SECTION_LABELS, sectionElementId } from "./SectionNav";

export function NextStageButton({ current }: { current: SectionId }) {
  const idx = SECTION_IDS.indexOf(current);
  const next = idx >= 0 ? SECTION_IDS[idx + 1] : undefined;
  if (!next) return null;

  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        onClick={() => {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          document
            .getElementById(sectionElementId(next))
            ?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
        }}
        className="tap-target inline-flex items-center gap-1 rounded-full border border-chart-grid bg-chart-bg px-3 py-1 text-xs text-chart-muted-text transition-colors hover:border-chart-info hover:text-foreground"
        title={`Jump to ${SECTION_LABELS[next]}`}
      >
        Next: {SECTION_LABELS[next]} <span aria-hidden>→</span>
      </button>
    </div>
  );
}
