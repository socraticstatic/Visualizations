/**
 * One source of truth for everything a machine reads about this site: the
 * canonical origin, per-route head tags, structured data, and the route list
 * the prerenderer and the sitemap both walk.
 *
 * Nothing here is imported by client code. It is pulled into the SSR bundle
 * only, so adding a route's metadata costs the browser bundle nothing.
 *
 * Origin and base are read from the environment so a move to a custom domain
 * is a build-time variable, not an edit across a dozen string literals:
 *   VITE_SITE_ORIGIN=https://charts.example.com VITE_BASE=/ npm run build
 */
import { POSTS } from "@/posts/registry";
import { PALETTE_VERSION } from "@/charts/version";

const ORIGIN = (import.meta.env.VITE_SITE_ORIGIN ?? "https://socraticstatic.github.io").replace(/\/+$/, "");
const BASE = import.meta.env.BASE_URL ?? "/";

/** Absolute URL for a path relative to the deploy base. "" is the site root. */
export function url(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return ORIGIN + BASE + clean;
}

export const SITE = {
  origin: ORIGIN,
  base: BASE,
  url: url(),
  name: "Micah's Chart System",
  /** The site's own wording, kept verbatim: this is the <h1> on the builder. */
  headline: "Micah's Chart System",
  headlineTail: "for Sane and Useful Color Strategies",
  /** Used where a page supplies no description of its own. */
  description:
    "A chart color system that audits every palette against WCAG 2.2 non-text contrast, " +
    "colorblind simulation, and grayscale before you ship it. Solve categorical palettes " +
    "around your brand colors, build sequential and diverging ramps, and see the numbers " +
    "behind each one.",
  author: {
    name: "Micah Boswell",
    url: "https://conscious-shell.com",
    github: "https://github.com/socraticstatic",
  },
  repo: "https://github.com/socraticstatic/Visualizations",
  npm: "https://www.npmjs.com/package/chart-color-system",
  mcpEndpoint: "https://chart-color-mcp.vercel.app/mcp",
  mcpDocs: url("mcp-docs.html"),
  version: PALETTE_VERSION,
} as const;

const person = {
  "@type": "Person",
  "@id": url() + "#micah",
  name: SITE.author.name,
  url: SITE.author.url,
  sameAs: [SITE.author.github, "https://www.linkedin.com/in/micahboswell"],
  jobTitle: "Experience Lead",
};

/**
 * Questions this site can answer with a measured number rather than an
 * opinion. Every answer below is a claim the engine or the benchmark post
 * actually supports - if one stops being true, the post it came from is
 * wrong too.
 */
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How many colors can a chart use before they stop being distinguishable?",
    a:
      "About six. Past roughly six hues no categorical palette keeps its colors reliably " +
      "distinct under dichromacy, and the published defaults are no exception: at six slots " +
      "Tableau 10's worst pair collapses to a colorblind ΔE of 0.7, effectively one color " +
      "drawn twice. Above six slots, series identity has to be carried by a second encoding " +
      "- dash pattern, decal fill, or marker shape - rather than by color alone.",
  },
  {
    q: "What contrast ratio do chart colors need?",
    a:
      "WCAG 2.2 Success Criterion 1.4.11 asks for 3:1 against adjacent colors for graphical " +
      "objects a reader needs in order to understand the content. Applied to a chart, that " +
      "covers the marks you must tell apart to read the data. The criterion exempts cases " +
      "where the specific appearance is essential, so a number below 3:1 is not automatically " +
      "a conformance failure - but a 2px line at 1.4:1 is a usability failure regardless.",
  },
  {
    q: "Is ColorBrewer Set2 colorblind safe?",
    a:
      "Not on its own, and not on every background. Measured at six slots, Set2's minimum " +
      "pairwise OKLab ΔE is 11.8 under normal vision but drops to 1.5 under the worst of " +
      "deuteranopia, protanopia and tritanopia. On a white background all eight of its slots " +
      "fall below the 3:1 non-text contrast floor, its worst (#FFD92F) at 1.38:1. On a dark " +
      "background (#111827) the same palette passes every slot with a worst case of 6.78:1. " +
      "Set2 was designed for cartography and print, where marks are large filled regions.",
  },
  {
    q: "Does a chart palette need to change between light and dark mode?",
    a:
      "Usually yes, because contrast is separation from the background and the background is " +
      "the one variable the palette author never had. Measured against the 3:1 floor, the " +
      "ranking of five common default palettes nearly inverts when the background changes " +
      "from white to #111827: ColorBrewer Set2 goes from worst to best, and IBM Carbon from " +
      "the only passing palette to the worst, with five of ten slots failing.",
  },
  {
    q: "What is the difference between hue separation and contrast in a chart palette?",
    a:
      "They are different problems with different inputs. Hue separation is the distance " +
      "between colors in the palette - it keeps slot 3 from reading as slot 7, and it depends " +
      "only on the palette. Contrast is separation from the background, and it depends on " +
      "where the chart is drawn. A qualitative palette can be excellent at the first and " +
      "indifferent to the second.",
  },
];

/** JSON-LD shared by every page: who made this, and what it is. */
function baseGraph(): object[] {
  return [
    {
      "@type": "WebSite",
      "@id": url() + "#website",
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: "en",
      publisher: { "@id": url() + "#micah" },
    },
    person,
  ];
}

function softwareGraph(): object[] {
  return [
    {
      "@type": "SoftwareApplication",
      "@id": url() + "#app",
      name: SITE.name,
      alternateName: "chart-color-system",
      url: SITE.url,
      applicationCategory: "DesignApplication",
      applicationSubCategory: "Data visualization color tool",
      operatingSystem: "Any browser",
      softwareVersion: SITE.version,
      description: SITE.description,
      author: { "@id": url() + "#micah" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Solve a categorical chart palette around fixed brand anchor colors",
        "Audit palettes against WCAG 2.2 non-text contrast (3:1 floor)",
        "Simulate deuteranopia, protanopia, tritanopia and achromatopsia (Machado 2009)",
        "Build sequential and diverging ramps with monotonic OKLab lightness",
        "Pair every color slot with a matching dash, decal and marker shape",
        "Grayscale survival audit",
      ],
      softwareHelp: { "@type": "CreativeWork", url: SITE.mcpDocs },
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": url() + "#source",
      name: "chart-color-system",
      description:
        "The palette engine behind the app, published to npm: contrast-, CVD- and " +
        "grayscale-audited categorical, sequential and diverging chart palettes.",
      codeRepository: SITE.repo,
      programmingLanguage: "TypeScript",
      license: "https://opensource.org/licenses/MIT",
      author: { "@id": url() + "#micah" },
      targetProduct: { "@id": url() + "#app" },
    },
    {
      "@type": "FAQPage",
      "@id": url() + "#faq",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
}

function postGraph(slug: string, title: string, date: string, summary: string): object[] {
  const pageUrl = url(`blog/${slug}`);
  return [
    {
      "@type": "TechArticle",
      "@id": pageUrl + "#article",
      headline: title,
      description: summary,
      url: pageUrl,
      datePublished: date,
      dateModified: date,
      inLanguage: "en",
      author: { "@id": url() + "#micah" },
      publisher: { "@id": url() + "#micah" },
      isPartOf: { "@id": url() + "#website" },
      mainEntityOfPage: pageUrl,
      about: [
        { "@type": "Thing", name: "Data visualization" },
        { "@type": "Thing", name: "Web accessibility" },
        { "@type": "Thing", name: "Color vision deficiency" },
      ],
      /** The post's tables are generated by the engine at render time. */
      citation: { "@type": "SoftwareSourceCode", "@id": url() + "#source" },
    },
  ];
}

export interface RouteMeta {
  /** Path relative to the deploy base, no leading slash. "" is the root. */
  path: string;
  /** Router path to render, always rooted. */
  route: string;
  title: string;
  description: string;
  /**
   * "app"     - server-render the real route components.
   * "summary" - server-render the static summary written for this route.
   * "shell"   - ship the unmodified app shell (200, no body content).
   */
  render: "app" | "summary" | "shell";
  /**
   * Whether the client may hydrate this route's prerendered markup instead of
   * re-rendering it.
   *
   * Only safe when the route renders identically in Node and in the browser.
   *
   * That used to be false here: Math.cbrt (OKLab conversion) and Math.exp (the
   * annealing acceptance test) returned different values under Node 24 than
   * under Chrome 152, so any route running the solver produced a different
   * palette on each side and hydration failed with React #418/#425.
   *
   * Fixed in 0.8.0 - palette/deterministic.ts replaced both with versions
   * built only from correctly-rounded operations, and the same bundle now
   * returns byte-identical palettes under Node 24, Chrome 152 and
   * JavaScriptCore across all 64 configurations
   * (docs/spikes/engine-divergence.md).
   *
   * That unblocked the routes it applied to, and they are already true: /blog
   * and the post route both render: "app". Nothing is left to re-enable. The
   * two routes still false are false for structural reasons the fix does not
   * touch - "/" renders a written summary whose markup is deliberately not the
   * app's, and /charts ships a shell with no markup to hydrate. Do not read
   * the paragraph above as an invitation to flip them; turning "/" into
   * render: "app" would trade 763 words of crawlable prose for a canvas
   * skeleton that crawlers cannot execute.
   */
  hydrate: boolean;
  /** Left out of the sitemap when false. */
  indexable: boolean;
  /**
   * Path this route declares canonical, when that is not itself. A duplicate
   * route should point at the original rather than self-canonicalise.
   */
  canonicalPath?: string;
  lastmod?: string;
  priority: number;
  jsonLd: object[];
  /** Served next to the HTML as <path>.md for machine readers. */
  markdownSource?: string;
}

export function routes(): RouteMeta[] {
  const list: RouteMeta[] = [
    {
      path: "",
      route: "/",
      title: `${SITE.headline} ${SITE.headlineTail}`,
      description: SITE.description,
      // The builder is ECharts, canvas and live solving. Server-rendering it
      // would ship a skeleton that says nothing, so the route ships a written
      // summary of what the tool does and what it measures - the honest
      // pre-JavaScript state of the page, which the app replaces on mount.
      render: "summary",
      // Deliberately different markup from the app that replaces it.
      hydrate: false,
      indexable: true,
      priority: 1,
      jsonLd: [...baseGraph(), ...softwareGraph()],
    },
    {
      path: "blog",
      route: "/blog",
      title: `Notes — ${SITE.name}`,
      description:
        "Working notes on chart color, contrast, and the encodings that keep a chart " +
        "readable when color stops carrying it. Every figure is computed by the engine, " +
        "not transcribed.",
      render: "app",
      // The index renders post titles and dates. No solver, no drift.
      hydrate: true,
      indexable: true,
      priority: 0.8,
      lastmod: POSTS[0]?.date,
      jsonLd: [
        ...baseGraph(),
        {
          "@type": "Blog",
          "@id": url("blog") + "#blog",
          url: url("blog"),
          name: `Notes — ${SITE.name}`,
          inLanguage: "en",
          author: { "@id": url() + "#micah" },
          blogPost: POSTS.map((p) => ({
            "@type": "TechArticle",
            headline: p.title,
            url: url(`blog/${p.slug}`),
            datePublished: p.date,
            description: p.summary,
          })),
        },
      ],
    },
  ];

  for (const post of POSTS) {
    list.push({
      path: `blog/${post.slug}`,
      route: `/blog/${post.slug}`,
      title: `${post.title} · ${SITE.name}`,
      description: post.summary,
      render: "app",
      // Safe again: the only figures that differed between Node and the
      // browser were the solver's, and those are now frozen at build time
      // (src/posts/benchmarkFacts.ts) rather than solved per reader.
      hydrate: true,
      indexable: true,
      priority: 0.9,
      lastmod: post.date,
      jsonLd: [...baseGraph(), ...postGraph(post.slug, post.title, post.date, post.summary)],
      markdownSource: `docs/posts/${post.slug}.md`,
    });
  }

  // /charts is the builder under a second name. It has to resolve 200 rather
  // than 404, but it must not compete with / in an index, so it ships the
  // shell with a canonical pointing home and stays out of the sitemap.
  list.push({
    path: "charts",
    route: "/charts",
    title: `${SITE.headline} ${SITE.headlineTail}`,
    description: SITE.description,
    render: "shell",
    hydrate: false,
    indexable: false,
    canonicalPath: "",
    priority: 0.1,
    jsonLd: [],
  });

  return list;
}

/**
 * Pages that are hand-written static HTML rather than app routes. They still
 * belong in the sitemap and in llms.txt - mcp-docs.html is the page an
 * assistant is pointed at when someone asks how to connect the tool.
 */
export function staticPages() {
  return [
    {
      path: "mcp-docs.html",
      title: "Chart Color System as a tool · MCP server",
      lastmod: undefined as string | undefined,
      priority: 0.7,
    },
  ];
}

export { FAQ };
