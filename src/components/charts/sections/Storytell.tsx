/**
 * Storytell — how the palette carries meaning: callouts, emphasis, and density.
 *
 * scroll-mt-14 clears the 48px sticky bar so an anchored jump does not land
 * with the heading hidden underneath it.
 */
export function Storytell({ children }: { children: React.ReactNode }) {
  return (
    <section id="section-storytell" className="scroll-mt-14 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
        Storytell
      </h2>
      {children}
    </section>
  );
}
