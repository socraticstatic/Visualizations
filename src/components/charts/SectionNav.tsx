/**
 * SectionNav — four scroll-anchored sections in one sticky bar.
 *
 * Replaces FlowStepper, which showed seven pills that all pointed into a
 * single <section id="flow-build">, left two of its targets (flow-verify,
 * flow-reuse) with no heading at all, and could not reach the two screens of
 * audit content sitting outside its map entirely.
 *
 * Deliberately NOT a tablist. The sections are scroll-anchored, so tab
 * semantics would tell a screen reader that content swaps when it does not.
 * This is a nav with aria-current, which is what it actually is.
 */
import { useEffect, useState } from "react";
import { SECTION_IDS, type SectionId } from "@/charts/urlState";

export const SECTION_LABELS: Record<SectionId, string> = {
  evidence: "Evidence",
  storytell: "Storytell",
  reuse: "Reuse",
  ship: "Ship",
};

/** DOM id for a section anchor. Section wrappers must match this. */
export function sectionElementId(id: SectionId): string {
  return `section-${id}`;
}

export function SectionNav({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [active, setActive] = useState<SectionId>(SECTION_IDS[0]);

  useEffect(() => {
    /**
     * The LAST section whose top has crossed the threshold line wins.
     *
     * FlowStepper picked the highest intersectionRatio, so the tallest visible
     * section stayed lit even while a shorter one below it was being read.
     * Evidence absorbs the permutation sweeps and is by far the tallest
     * section here, so that bug would have been permanent.
     */
    function onScroll() {
      const line = window.innerHeight * 0.3;
      let current: SectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(sectionElementId(id));
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav
      aria-label="Sections"
      className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SECTION_IDS.map((id) => {
        const isActive = active === id;
        return (
          <a
            key={id}
            href={`#${sectionElementId(id)}`}
            aria-current={isActive ? "true" : undefined}
            onClick={(e) => {
              // ShareLink owns location.hash for palette state, so letting the
              // browser follow this anchor would wipe the user's whole
              // configuration. The href stays for middle-click and a11y.
              e.preventDefault();
              onNavigate(id);
            }}
            className={[
              "tap-target inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs transition-colors",
              isActive
                ? "border-chart-info-strong bg-chart-info-strong font-medium text-chart-bg"
                : "border-chart-grid bg-chart-surface text-chart-muted-text hover:text-foreground",
            ].join(" ")}
          >
            {SECTION_LABELS[id]}
          </a>
        );
      })}
    </nav>
  );
}
