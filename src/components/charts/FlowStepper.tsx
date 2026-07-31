import { useEffect, useState } from "react";

export type FlowStep = {
  id: string;
  label: string;
};

export const FLOW_STEPS: FlowStep[] = [
  { id: "choose", label: "Choose" },
  { id: "build", label: "Build" },
  { id: "verify", label: "Verify" },
  { id: "storytell", label: "Storytell" },
  { id: "reuse", label: "Reuse" },
  { id: "ship", label: "Ship" },
  { id: "reference", label: "Reference" },
];

export function FlowStepper() {
  const [active, setActive] = useState<string>(FLOW_STEPS[0].id);

  useEffect(() => {
    const els = FLOW_STEPS
      .map((s) => document.getElementById(`flow-${s.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^flow-/, "");
          if (e.isIntersecting) visible.set(id, e.intersectionRatio);
          else visible.delete(id);
        }
        if (visible.size) {
          const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0];
          setActive(top);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="Workflow stepper"
      className="sticky top-0 z-30 -mx-6 border-b border-chart-grid/70 bg-[hsl(var(--page-bg)/0.85)] px-6 py-2 backdrop-blur"
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {FLOW_STEPS.map((s, i) => {
          const isActive = active === s.id;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <a
                href={`#flow-${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`flow-${s.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActive(s.id);
                }}
                aria-current={isActive ? "step" : undefined}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                  isActive
                    ? "border-chart-info bg-chart-info-strong text-chart-bg font-medium"
                    : "border-chart-grid bg-chart-surface text-chart-axis hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] tabular-nums",
                    isActive
                      ? "bg-chart-bg/20 text-chart-bg"
                      : "bg-chart-bg text-chart-axis",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                {s.label}
              </a>
              {i < FLOW_STEPS.length - 1 && (
                <span className="text-chart-axis/60" aria-hidden>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
