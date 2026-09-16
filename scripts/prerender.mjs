/**
 * Turns the single-page build into a set of real pages.
 *
 * GitHub Pages serves static files. Before this ran, /blog and every post
 * resolved through 404.html - the app loaded and the reader saw the page, but
 * the response carried status 404, and every crawler that matters drops a 404
 * on the floor. The site's own research was invisible to search and to every
 * answer engine.
 *
 * So each route in src/seo/routes gets its own directory with an index.html
 * in it: status 200, the route's own <title> and description, a canonical,
 * Open Graph tags, JSON-LD, and - for the routes that render server-side -
 * the actual text of the page in the HTML, so a crawler that does not run
 * JavaScript reads the argument instead of an empty <div>.
 *
 * 404.html stays the bare shell. A genuinely unknown URL should still 404.
 *
 * Runs as part of `postbuild`, after vite has written dist/index.html with
 * hashed asset paths.
 */
import { build } from "vite";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { writeDiscovery } from "./discovery.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist");
const ssrDir = resolve(root, "node_modules/.cache/prerender-ssr");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The SSR bundle is a build artifact, not a deliverable - it never ships. */
async function buildSsrBundle() {
  rmSync(ssrDir, { recursive: true, force: true });
  await build({
    root,
    logLevel: "warn",
    plugins: [react()],
    resolve: { alias: { "@": resolve(root, "src") } },
    base: process.env.VITE_BASE ?? "/",
    build: {
      ssr: resolve(root, "src/entry-server.tsx"),
      outDir: ssrDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: "entry-server.mjs" } },
    },
  });
  return pathToFileURL(resolve(ssrDir, "entry-server.mjs")).href;
}

/**
 * Replaces the shell's generic head with the route's own, and drops the
 * rendered body into #root. String surgery rather than a parser: the template
 * is one file we control, and a dependency for four replacements is not worth
 * the supply chain.
 */
/**
 * GitHub Pages serves a directory by redirecting the slashless URL to the
 * trailing-slash one, so the trailing-slash form is the URL that answers 200
 * and therefore the one to declare canonical.
 */
function pageUrl(SITE, path) {
  if (!path) return `${SITE.origin}${SITE.base}`;
  return `${SITE.origin}${SITE.base}${path}/`;
}

function pageHtml(shell, route, SITE, bodyHtml) {
  const canonical = pageUrl(SITE, route.path);
  let html = shell;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`);
  html = html.replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${esc(route.description)}" />`,
  );

  const head = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    route.indexable
      ? `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />`
      : `<meta name="robots" content="noindex, follow" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
  ];

  if (route.markdownSource) {
    // Point a machine reader at the plain-text twin of this page.
    head.push(
      `<link rel="alternate" type="text/markdown" href="${esc(`${SITE.origin}${SITE.base}${route.path}.md`)}" title="${esc(route.title)} (Markdown)" />`,
    );
  }

  if (route.jsonLd.length) {
    const graph = { "@context": "https://schema.org", "@graph": route.jsonLd };
    // </script> inside a JSON string would close the tag early.
    const json = JSON.stringify(graph, null, 2).replace(/<\//g, "<\\/");
    head.push(`<script type="application/ld+json">\n${json}\n</script>`);
  }

  html = html.replace("</head>", `  ${head.join("\n    ")}\n  </head>`);

  // The og:title and og:description in the shell are the site defaults.
  html = html
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(route.title)}" />`)
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${esc(route.description)}" />`,
    );

  if (bodyHtml) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root" data-hydrate="${route.hydrate ? "yes" : "no"}">${bodyHtml}</div>`,
    );
  }

  return html;
}

/**
 * The build's own check that it produced what it claims.
 *
 * This file exists because the site silently shipped 404s for months while
 * looking fine in a browser. A silent regression is the failure mode, so the
 * build fails loudly rather than trusting that the writes above worked.
 */
function verify({ outDir, SITE, routeList }) {
  const problems = [];

  for (const route of routeList) {
    const file = route.path ? resolve(outDir, route.path, "index.html") : resolve(outDir, "index.html");
    if (!existsSync(file)) {
      problems.push(`${route.route}: no index.html written - this URL would 404`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    const canonical = pageUrl(SITE, route.path);

    if (!html.includes(`rel="canonical" href="${canonical}"`)) {
      problems.push(`${route.route}: canonical is not ${canonical}`);
    }
    if (!html.includes(`<title>${route.title.replace(/&/g, "&amp;")}`) && !html.includes(`<title>${route.title}`)) {
      problems.push(`${route.route}: <title> is not the route's own`);
    }
    if (route.indexable && html.includes('name="robots" content="noindex')) {
      problems.push(`${route.route}: indexable route carries noindex`);
    }
    for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(block[1]);
      } catch (error) {
        problems.push(`${route.route}: JSON-LD does not parse (${error.message})`);
      }
    }
    if (route.render !== "shell" && !html.includes("data-hydrate=")) {
      problems.push(`${route.route}: rendered body was not injected`);
    }
  }

  const sitemap = readFileSync(resolve(outDir, "sitemap.xml"), "utf8");
  for (const route of routeList) {
    const loc = `<loc>${pageUrl(SITE, route.path)}</loc>`;
    const listed = sitemap.includes(loc);
    if (route.indexable && !listed) problems.push(`${route.route}: indexable but missing from sitemap.xml`);
    if (!route.indexable && listed) problems.push(`${route.route}: not indexable but listed in sitemap.xml`);
  }

  if (problems.length) {
    console.error("\nprerender verification failed:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\nverified ${routeList.length} routes: canonical, title, JSON-LD, sitemap.`);
}

async function main() {
  const shellPath = resolve(outDir, "index.html");
  if (!existsSync(shellPath)) {
    console.error("dist/index.html missing - run the app build first.");
    process.exit(1);
  }
  const shell = readFileSync(shellPath, "utf8");

  const entry = await buildSsrBundle();
  const { render, routes, SITE } = await import(entry);
  const routeList = routes();

  const written = [];
  for (const route of routeList) {
    let body = "";
    try {
      body = render(route);
    } catch (error) {
      // A route that cannot render must fail the build. Shipping it empty
      // would restore exactly the problem this script exists to fix.
      console.error(`\nprerender failed for "${route.route}":\n`, error);
      process.exit(1);
    }
    if (route.render !== "shell" && body.length < 500) {
      console.error(`\nprerender produced ${body.length} bytes for "${route.route}" - refusing to ship it.`);
      process.exit(1);
    }

    const html = pageHtml(shell, route, SITE, body);
    const file = route.path ? resolve(outDir, route.path, "index.html") : shellPath;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    written.push({ path: `/${route.path}`, mode: route.render, bytes: body.length });
  }

  // 404.html is the shell, unmodified and noindex: an unknown URL hands off to
  // the client router but keeps its 404 status, which is the correct answer.
  const notFound = pageHtml(
    shell,
    {
      path: "404",
      title: `Not found — ${SITE.name}`,
      description: SITE.description,
      indexable: false,
      jsonLd: [],
      render: "shell",
    },
    SITE,
    "",
  );
  writeFileSync(resolve(outDir, "404.html"), notFound);

  const posts = routeList
    .filter((r) => r.markdownSource)
    .map((r) => ({
      slug: r.path.replace(/^blog\//, ""),
      title: r.title.split(" · ")[0],
      summary: r.description,
      date: r.lastmod,
    }));

  const discovery = writeDiscovery({ outDir, root, SITE, routeList, posts });

  verify({ outDir, SITE, routeList });

  console.log("\nprerendered:");
  for (const w of written) console.log(`  ${w.path.padEnd(34)} ${w.mode.padEnd(8)} ${w.bytes} bytes`);
  console.log("  /404.html                          shell    0 bytes");
  console.log("\ndiscovery:");
  for (const f of discovery) console.log(`  /${f}`);
  console.log(`\ncanonical origin: ${SITE.origin}${SITE.base}\n`);
}

main();
