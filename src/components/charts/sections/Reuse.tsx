/**
 * Reuse — keeping a palette across charts and sessions: presets, workflows, entity pins.
 *
 * scroll-mt-14 clears the 48px sticky bar so an anchored jump does not land
 * with the heading hidden underneath it.
 */
export function Reuse({ children }: { children: React.ReactNode }) {
  return (
    <section id="section-reuse" className="scroll-mt-14 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
        Reuse
      </h2>
      {children}
    </section>
  );
}
