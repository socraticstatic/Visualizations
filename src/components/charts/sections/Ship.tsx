/**
 * Ship — getting the palette out of the tool: code snippet, export, share link.
 *
 * scroll-mt-14 clears the 48px sticky bar so an anchored jump does not land
 * with the heading hidden underneath it.
 */
export function Ship({ children }: { children: React.ReactNode }) {
  return (
    <section id="section-ship" className="scroll-mt-14 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-chart-muted-text">
        Ship
      </h2>
      {children}
    </section>
  );
}
