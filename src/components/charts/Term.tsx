/**
 * Term — an inline technical term that defines itself in place.
 *
 * The glossary used to be a collapsed panel at the bottom of an 8-screen page.
 * "ΔE" appears 61 times on screen and was defined in exactly one place nobody
 * scrolled to. A term should carry its own meaning where it is used.
 *
 * Wrap the FIRST occurrence per panel, not every occurrence, or the page turns
 * into a field of dotted underlines and the signal is gone.
 *
 * Renders plain children when the id does not resolve, so a typo degrades to
 * ordinary text instead of throwing. src/charts/__tests__/glossary.test.ts
 * pins the ids that are hardcoded in JSX, since that silent degradation is
 * exactly the kind of thing that would otherwise go unnoticed.
 */
import { useEffect, useRef, useState } from "react";
import { lookup } from "@/charts/glossary";

/** Fired at the window so ChartsDemo can open the drawer at this entry. */
export const OPEN_REFERENCE_EVENT = "open-reference";

export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const entry = lookup(id);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!entry) return <>{children}</>;

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${entry.term}: ${entry.short}`}
        className="cursor-help underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-focus"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 block w-64 rounded-md border border-chart-grid bg-chart-bg p-2 text-[11px] font-normal normal-case tracking-normal shadow-lg"
        >
          <span className="block font-medium text-foreground">{entry.term}</span>
          <span className="mt-0.5 block text-chart-muted-text">{entry.short}</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(
                new CustomEvent(OPEN_REFERENCE_EVENT, { detail: entry.term })
              );
            }}
            className="mt-1 block text-chart-info-text underline"
          >
            Full definition
          </button>
        </span>
      )}
    </span>
  );
}
