import { BlogLayout, Prose } from "@/components/blog/BlogLayout";
import { FAQ, SITE } from "@/seo/site";

/**
 * The builder route before JavaScript runs.
 *
 * The app at "/" is a live solver: ECharts canvases, sliders, a palette that
 * recomputes as you move it. None of that server-renders into anything a
 * reader or a crawler can use, and an empty <div id="root"> is worse - it is
 * a 200 with nothing in it.
 *
 * So the prerendered body of "/" is this: a written account of what the tool
 * does and what it measures, which the app replaces when it mounts. Not a
 * teaser and not a separate marketing page - the same claims the builder
 * makes, in the form a machine can read. Every number here is a constant the
 * engine enforces or a figure from the linked note, not a rounded-up one.
 */
export default function BuilderSummary() {
  return (
    <BlogLayout>
      <Prose>
        <header className="pt-10 sm:pt-14">
          <p className="text-[11px] uppercase tracking-[0.18em] text-chart-axis">
            Version {SITE.version}
          </p>
          {/* Same heading the builder renders, so the page a crawler reads
              and the page a reader sees are the same page. */}
          <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.1] tracking-tight md:text-4xl">
            {SITE.headline}{" "}
            <span className="text-chart-muted-text">{SITE.headlineTail}</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-chart-muted-text">
            An interactive builder that solves a categorical chart palette around the brand
            colors you have to keep, then audits it against WCAG 2.2 non-text contrast,
            colorblind simulation, and grayscale before you ship it. It also builds sequential
            and diverging ramps, and pairs every color slot with a dash, a decal, and a marker
            shape so a chart stays readable when color stops carrying it.
          </p>
          <p className="mt-3 text-sm text-chart-muted-text">
            The builder is running on this page. If you are reading this text instead, it has
            not loaded yet or JavaScript is off.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold tracking-tight">What it measures</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-chart-muted-text">
            <li>
              <strong className="text-foreground">Contrast.</strong> WCAG 2.2 SC 1.4.11 non-text
              contrast of every slot against the chart background, against a 3:1 floor.
            </li>
            <li>
              <strong className="text-foreground">Color-vision deficiency.</strong> Pairwise OKLab
              ΔE separation under deuteranopia, protanopia, tritanopia, and achromatopsia, using
              the published Machado (2009) simulation matrices.
            </li>
            <li>
              <strong className="text-foreground">Grayscale.</strong> Whether the palette survives
              when hue is removed entirely, which is also what a fax, a photocopy, and a
              monochrome print do to it.
            </li>
            <li>
              <strong className="text-foreground">Redundant encoding.</strong> A dash pattern,
              decal fill, and marker shape matched to each slot, so series identity does not
              depend on color alone.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold tracking-tight">Where it loses</h2>
          <p className="mt-3 text-sm leading-relaxed text-chart-muted-text">
            Past roughly six hues, no categorical palette keeps its colors reliably distinct under
            dichromacy. This one does not either. Above six slots the solver relaxes its own
            floors, and it says so in the result rather than returning a palette that looks
            solved. What the tool does at that point is tell you where the wall is, and hand you
            the second encoding that gets you past it.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold tracking-tight">Questions it answers</h2>
          <dl className="mt-4 flex flex-col gap-5">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-display text-base font-semibold leading-snug tracking-tight text-foreground">
                  {q}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-chart-muted-text">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 pb-8">
          <h2 className="font-display text-xl font-semibold tracking-tight">The same engine, elsewhere</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-chart-muted-text">
            <li>
              <a className="text-primary underline underline-offset-4" href={SITE.npm}>
                chart-color-system
              </a>{" "}
              on npm — the solver and audit as a library. MIT.
            </li>
            <li>
              <a className="text-primary underline underline-offset-4" href={SITE.mcpDocs}>
                An MCP server
              </a>{" "}
              at <code>{SITE.mcpEndpoint}</code> — the same engine as a tool an AI assistant can
              call, read-only and unauthenticated.
            </li>
            <li>
              <a className="text-primary underline underline-offset-4" href={SITE.base + "blog"}>
                Notes
              </a>{" "}
              — measured write-ups, with every figure computed by the engine at render time.
            </li>
            <li>
              <a className="text-primary underline underline-offset-4" href={SITE.repo}>
                Source on GitHub
              </a>
              .
            </li>
          </ul>
        </section>
      </Prose>
    </BlogLayout>
  );
}
