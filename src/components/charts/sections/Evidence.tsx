/**
 * Evidence — proof for a reviewer, as distinct from the pinned PaletteVerdict which serves the person actively building. Holds the vision matrix, semantic role audit, permutation sweep, and benchmarks.
 *
 * scroll-mt-14 clears the 48px sticky bar so an anchored jump does not land
 * with the heading hidden underneath it.
 */
export function Evidence({ children }: { children: React.ReactNode }) {
  return (
    <section id="section-evidence" className="scroll-mt-14 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
        Evidence
      </h2>
      {children}
    </section>
  );
}
