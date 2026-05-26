import { FLOW_STEPS } from "./FlowStepper";

export function NextStageButton({ current }: { current: string }) {
  const idx = FLOW_STEPS.findIndex((s) => s.id === current);
  const next = idx >= 0 ? FLOW_STEPS[idx + 1] : undefined;
  if (!next) return null;
  return (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        onClick={() =>
          document
            .getElementById(`flow-${next.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        className="inline-flex items-center gap-1 rounded-full border border-chart-grid bg-chart-bg px-3 py-1 text-xs text-chart-axis hover:text-foreground hover:border-chart-info transition-colors"
        title={`Jump to ${next.label}`}
      >
        Next: {next.label} <span aria-hidden>→</span>
      </button>
    </div>
  );
}
