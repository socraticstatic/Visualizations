// mcp/api/mcp.js — the Chart Color System as a tool assistants can call.
//
// A public, read-only MCP server over streamable HTTP, served at /mcp
// (vercel.json rewrites it here). Every tool runs the same engine the app at
// socraticstatic.github.io/Visualizations runs (npm: chart-color-system), so
// an assistant asked "six chart colors that keep my brand blue and survive
// deuteranopia" gets a solved, audited palette with the engine's own honesty
// lines, instead of a guess.
//
// Its own Vercel project (chart-color-mcp): the app is static on GitHub Pages.
// Stateless: fresh transport per POST, GET refused with a pointer to the docs,
// browser callers limited to the origins below. Server-to-server callers
// (ChatGPT, Claude) send no Origin.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  fromCss, solveCategorical, auditPalette, simulateColor, contrastRatio,
  sequentialRamp, divergingRamp, MAX_SLOTS, PALETTE_VERSION,
} from 'chart-color-system';

// The package types declare VISION_MODES but its runtime barrel does not
// export it (0.7.3); importing it is a cold-start crash. Same five modes.
const VISION_MODES = ['normal', 'deutan', 'protan', 'tritan', 'achromatopsia'];

const APP = 'https://socraticstatic.github.io/Visualizations/';
const DOCS = `${APP}mcp-docs.html`;
const VERSION = '0.1.0';
const ORIGINS = ['socraticstatic.github.io', 'chatgpt.com', 'openai.com', 'claude.ai', 'anthropic.com', 'localhost'];

// The solver accepts up to MAX_SLOTS, but the 2026-08-16 audit showed the
// lightness floor relaxes silently above six; the app says so and so do we.
const HONEST_CAP = 6;

const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);

function color(css, what = 'color') {
  let c;
  try { c = fromCss(String(css).trim()); } catch { c = undefined; }
  if (!c || !Number.isFinite(c.rgb.r) || !Number.isFinite(c.oklab.l)) {
    throw new Error(`Unrecognized ${what} "${css}". Use #hex, rgb(), hsl(), or a CSS color name.`);
  }
  return c;
}
const colors = (list, what) => list.map((s) => color(s, what));
const isDark = (bg) => bg.oklab.l < 0.5;
const appUrl = (n, bg) => `${APP}#n=${n}&t=${isDark(bg) ? 'dark' : 'light'}&v=normal`;

function auditOut(palette, bg, ramp = false) {
  const a = auditPalette(palette, bg, ramp);
  return {
    overall: a.overall,
    bg_pass: a.bgPass,
    worst_contrast_vs_bg: r3(a.worstContrastVsBg),
    per_vision: a.perVision.map((v) => ({ mode: v.mode, min_delta_e: r3(v.minDeltaE), threshold: r3(v.threshold), pass: v.pass })),
  };
}

function buildServer() {
  const server = new McpServer(
    { name: 'chart-color-system', version: VERSION },
    {
      instructions:
        'The Chart Color System solves, audits and simulates chart color palettes: categorical palettes that stay distinguishable under normal vision and colorblindness (deuteranopia, protanopia, tritanopia, achromatopsia), with WCAG non-text contrast against the chart background. ' +
        'Use solve_palette when the user needs colors (pass brand colors as anchors; they are kept exactly, in slot order). Use audit_palette to judge colors they already have. Use simulate_palette to show what a colorblind reader sees. Use build_ramp for sequential or diverging scales. ' +
        `Numbers are OKLab distances and WCAG contrast ratios from engine ${PALETTE_VERSION}; report them and the relaxations honestly. The honest safe cap for categorical slots is ${HONEST_CAP}; above that, recommend a second encoding (shape, dash, position). ` +
        'Every result carries app_url; offer it so the user can open the palette in the app.',
    },
  );

  server.registerTool('solve_palette', {
    title: 'Solve a chart palette',
    description: `Generate a categorical chart palette of n colors (1-${MAX_SLOTS}) that maximizes perceptual separation under normal vision and colorblindness, with the given brand colors locked as anchors in slot order. Returns the palette, the worst pair distances, the engine's relaxation notes, a full accessibility audit against the background, and a link to open it in the app. Honest cap is ${HONEST_CAP} slots; above that the result says so.`,
    inputSchema: {
      n: z.number().int().min(1).max(MAX_SLOTS).default(6).describe('Number of categorical slots'),
      anchors: z.array(z.string()).max(MAX_SLOTS).default([]).describe('Brand or required colors, kept exactly, in slot order (CSS syntax)'),
      background: z.string().default('#ffffff').describe('Chart background color'),
      grid: z.string().optional().describe('Gridline color; defaults to a light or dark gray to match the background'),
      posture: z.enum(['kpi', 'comparative', 'exploratory']).default('comparative').describe('kpi: few strong colors; comparative: balanced; exploratory: many muted'),
    },
    annotations: ro,
  }, async ({ n, anchors, background, grid, posture }) => {
    try {
      const bg = color(background, 'background');
      const gridC = color(grid ?? (isDark(bg) ? '#374151' : '#e5e7eb'), 'grid');
      const locks = colors(anchors, 'anchor');
      const r = solveCategorical({ n, posture, background: bg, grid: gridC, locks });
      return text({
        palette: r.palette.map((c, i) => ({ slot: i + 1, hex: c.hex, locked: i < locks.length, contrast_vs_background: r3(contrastRatio(c, bg)) })),
        min_pair_delta_e: r3(r.minPairDeltaE),
        min_cvd_delta_e: r3(r.minCvdDeltaE),
        worst_pair: r.worstPair.map((i) => i + 1),
        relaxations: r.relaxations,
        audit: auditOut(r.palette, bg),
        note: n > HONEST_CAP
          ? `Above ${HONEST_CAP} slots the engine relaxes its lightness floor and some pairs may be distinguishable only by position; pair the color with a shape, dash or label encoding.`
          : undefined,
        posture, background: bg.hex, grid: gridC.hex, engine_version: PALETTE_VERSION, app_url: appUrl(n, bg),
      });
    } catch (e) { return fail(e.message); }
  });

  server.registerTool('audit_palette', {
    title: 'Audit a chart palette',
    description: 'Audit existing chart colors for accessibility: pairwise OKLab separation under normal vision, deuteranopia, protanopia, tritanopia and achromatopsia, plus WCAG 2.2 non-text contrast (3:1) of every color against the chart background. Returns a pass / warn / fail verdict with the numbers behind it. Set ramp=true for sequential or diverging scales, whose steps are meant to be close.',
    inputSchema: {
      colors: z.array(z.string()).min(1).max(24).describe('Palette colors in slot order (CSS syntax)'),
      background: z.string().default('#ffffff').describe('Chart background color'),
      ramp: z.boolean().default(false).describe('true for a sequential or diverging scale (skips pairwise separation)'),
    },
    annotations: ro,
  }, async ({ colors: list, background, ramp }) => {
    try {
      const bg = color(background, 'background');
      const pal = colors(list, 'color');
      return text({
        ...auditOut(pal, bg, ramp),
        per_color: pal.map((c, i) => ({ slot: i + 1, hex: c.hex, contrast_vs_background: r3(contrastRatio(c, bg)) })),
        background: bg.hex, engine_version: PALETTE_VERSION, app_url: appUrl(Math.min(pal.length, MAX_SLOTS), bg),
      });
    } catch (e) { return fail(e.message); }
  });

  server.registerTool('simulate_palette', {
    title: 'Simulate colorblind vision',
    description: 'Show what each color looks like to readers with deuteranopia, protanopia, tritanopia or achromatopsia (published Machado 2009 matrices), so an assistant can describe or render the palette as a colorblind reader sees it.',
    inputSchema: {
      colors: z.array(z.string()).min(1).max(24).describe('Colors in slot order (CSS syntax)'),
      modes: z.array(z.enum(VISION_MODES)).optional().describe('Vision modes to simulate; default all'),
    },
    annotations: ro,
  }, async ({ colors: list, modes }) => {
    try {
      const pal = colors(list, 'color');
      const wanted = modes && modes.length ? modes : VISION_MODES;
      const simulated = {};
      for (const m of wanted) simulated[m] = pal.map((c, i) => ({ slot: i + 1, hex: c.hex, simulated_hex: simulateColor(c, m).hex }));
      return text({ simulated, engine_version: PALETTE_VERSION });
    } catch (e) { return fail(e.message); }
  });

  server.registerTool('build_ramp', {
    title: 'Build a sequential or diverging ramp',
    description: 'Build an evenly spaced perceptual (OKLab) color scale: sequential from start to end, or diverging from start through mid to end. Returns the steps and a background-contrast audit (pairwise separation is not judged for ramps).',
    inputSchema: {
      kind: z.enum(['sequential', 'diverging']),
      start: z.string().describe('First color (or the negative end of a diverging scale)'),
      end: z.string().describe('Last color (or the positive end)'),
      mid: z.string().optional().describe('Middle color for a diverging scale; default a neutral near the background'),
      steps: z.number().int().min(3).max(24).default(7),
      background: z.string().default('#ffffff'),
    },
    annotations: ro,
  }, async ({ kind, start, end, mid, steps, background }) => {
    try {
      const bg = color(background, 'background');
      const a = color(start, 'start'), b = color(end, 'end');
      const ramp = kind === 'sequential'
        ? sequentialRamp(a, b, steps)
        : divergingRamp(a, color(mid ?? (isDark(bg) ? '#4b5563' : '#f5f5f4'), 'mid'), b, steps);
      return text({
        kind, ramp: ramp.map((c, i) => ({ step: i + 1, hex: c.hex, contrast_vs_background: r3(contrastRatio(c, bg)) })),
        audit: auditOut(ramp, bg, true), background: bg.hex, engine_version: PALETTE_VERSION,
      });
    } catch (e) { return fail(e.message); }
  });

  return server;
}

function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { const h = new URL(o).hostname; return ORIGINS.some((d) => h === d || h.endsWith('.' + d)); } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin && originOk(req) ? req.headers.origin : APP);
  res.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-protocol-version, mcp-session-id, accept, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-protocol-version');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!originOk(req)) { res.status(403).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Origin not allowed' }, id: null }); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: `This server is stateless: send JSON-RPC over POST. Docs: ${DOCS}` }, id: null });
    return;
  }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
