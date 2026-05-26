import { Eye, EyeOff } from "lucide-react";
import type { VisionMode } from "@/charts/audit";

/**
 * VisionPreviewToggle — prominent segmented control mounted directly beside
 * the chart that flips the live preview between normal vision and each CVD
 * simulation. Lets the user instantly verify that dashed/dotted patterns
 * and color differences still read under deutan / protan / tritan /
 * achromatopsia without scrolling to the deep controls row.
 *
 * State is owned by the page (`vision` / `setVision`). The actual filter
 * is already applied to the chart via `VISION_FILTER[vision]`; this
 * component just provides a fast, scannable way to switch it.
 */
const MODES: Array<{ value: VisionMode; label: string; sub: string }> = [
  { value: "normal", label: "Normal", sub: "baseline" },
  { value: "deutan", label: "Deutan", sub: "red-green" },
  { value: "protan", label: "Protan", sub: "red-green" },
  { value: "tritan", label: "Tritan", sub: "blue-yellow" },
  { value: "achromatopsia", label: "Mono", sub: "grayscale" },
];

export function VisionPreviewToggle({
  value,
  onChange,
}: {
  value: VisionMode;
  onChange: (v: VisionMode) => void;
}) {
  const isSim = value !== "normal";
  return (
    <div
      role="radiogroup"
      aria-label="Preview vision mode"
      className="rounded-md border border-border bg-card/30 p-2 space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {isSim ? (
            <EyeOff className="h-3 w-3 text-chart-target" aria-hidden />
          ) : (
            <Eye className="h-3 w-3 text-chart-positive" aria-hidden />
          )}
          Preview mode
        </div>
        <span className="text-[10px] text-muted-foreground">
          Patterns (dash · dot · marker) stay on in every mode
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {MODES.map((m) => {
          const active = m.value === value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m.value)}
              title={`Preview as ${m.label} (${m.sub})`}
              className={
                "rounded border px-1.5 py-1 text-center transition-colors " +
                (active
                  ? m.value === "normal"
                    ? "border-chart-positive/60 bg-chart-positive/15 text-chart-positive"
                    : "border-chart-target/60 bg-chart-target/15 text-chart-target"
                  : "border-border bg-background/40 text-foreground/80 hover:border-foreground/40")
              }
            >
              <div className="text-[11px] font-semibold leading-tight">{m.label}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-70 leading-tight">
                {m.sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
