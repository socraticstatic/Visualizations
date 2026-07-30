/**
 * Lightweight, dismissible 4-step coach tour for /charts.
 *
 * Anchors to elements by `data-tour` attribute (string id), positions a
 * tooltip below each target, dims the rest of the page, and persists a
 * "seen" flag in localStorage so it only auto-opens once. Users can re-open
 * it from a "Tour" button in the header.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SEEN_KEY = "chart-tour-seen-v1";

interface Step {
  target: string; // data-tour="..."
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: "chart-kind",
    title: "1 · Pick a chart kind",
    body:
      "Each kind is locked to one palette family (categorical, sequential, or diverging) and to the best-practice posture for the job. You can't pick a wrong color method here.",
  },
  {
    target: "n-slider",
    title: "2 · Set the series or step count",
    body:
      "Drag the slider or use the − / + steppers. The blue zone is safe by construction; each tick is one step. Past the safe cap the track turns amber — you can still go there, and the audit panel shows exactly which floor breaks.",
  },
  {
    target: "vision-preview",
    title: "3 · Preview other eyes",
    body:
      "Flip the live chart through deutan, protan, tritan, and grayscale simulation. Dash, decal, and marker patterns stay on in every mode — they are what keep series identifiable when color collapses.",
  },
  {
    target: "export-palette",
    title: "4 · Export the system",
    body:
      "When the palette looks right, export it as CSS variables, Tailwind config, an ECharts theme, Figma Tokens, or a printable SVG swatch sheet. The audit report and share link live next to it.",
  },
];

export function useShouldAutoOpenTour(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  function close() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }
  return [open, close];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CoachTour({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // Reset to step 0 each time the tour is opened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const t = STEPS[step];
      const el = document.querySelector<HTMLElement>(`[data-tour="${t.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // measure after scroll has a chance to settle
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect(r);
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    // Layout can shift without a scroll/resize event (builder changes
    // re-render the panel the tour points at). Re-measure on a slow tick so
    // the highlight tracks its anchor instead of floating over stale space —
    // this is what lets the tour stay open while the user tries the control
    // it is describing.
    const tick = window.setInterval(measure, 400);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(tick);
    };
  }, [open, step]);

  if (!open) return null;

  function next() {
    if (step >= STEPS.length - 1) {
      onClose();
      return;
    }
    setStep(step + 1);
  }
  function prev() {
    setStep(Math.max(0, step - 1));
  }

  const PAD = 8;
  const tip = STEPS[step];

  const tipStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + PAD, window.innerHeight - 220),
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 380)),
        width: 360,
      }
    : { position: "fixed", top: 80, left: 24, width: 360 };

  const highlightStyle: React.CSSProperties | null = rect
    ? {
        position: "fixed",
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        borderRadius: 8,
        boxShadow: "0 0 0 9999px hsla(0, 0%, 0%, 0.55)",
        border: "2px solid hsl(var(--chart-info))",
        pointerEvents: "none",
        zIndex: 60,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50" aria-live="polite">
      {highlightStyle ? (
        <div style={highlightStyle} />
      ) : (
        <div className="absolute inset-0 bg-background/60" onClick={onClose} />
      )}
      <div
        ref={tipRef}
        style={tipStyle}
        className="z-[70] panel shadow-2xl p-3 space-y-2"
        role="dialog"
        aria-label={tip.title}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">{tip.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-chart-axis hover:text-foreground"
            aria-label="Close tour"
          >
            Skip ✕
          </button>
        </div>
        <p className="text-[12px] text-foreground/85 leading-snug">{tip.body}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-chart-axis">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={step === 0}
              className="text-xs px-2 py-1 rounded border border-chart-grid bg-chart-bg text-foreground disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              className="text-xs px-3 py-1 rounded border border-chart-grid bg-chart-info text-chart-bg font-medium hover:opacity-90"
            >
              {step === STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
