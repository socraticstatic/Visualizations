/**
 * "Export comparison" — builds a self-contained HTML report and opens it in a
 * new window.
 *
 * Two layouts:
 *
 * 1. **Single variant + CVD simulation** (default, and the only option when
 *    vision !== "normal"). Renders the live chart twice — normal vision and a
 *    CVD-simulated copy (SVG color matrix). Tables are normal-vs-simulated.
 *
 * 2. **A vs. B** (when `variantB` is provided — Compare is on and vision is
 *    "normal"). Renders two independent normal-vision charts, then per-variant
 *    warning lists, per-vision ΔE audits, readability tables, and swatch grids
 *    side by side. The CVD-projection columns are dropped because both
 *    variants are at normal vision.
 *
 * The user exports to PDF via the browser's native Print → Save as PDF.
 * No new runtime dependencies — colors stay HSL/hex via the existing pipeline.
 */
import type { ChartKind } from "./chartKinds";
import { CHART_KIND_LABEL } from "./chartKinds";
import type { BestPractice } from "./bestPractices";
import type { AuditReport, VisionMode } from "./audit";
import { simulateColor, contrastRatio } from "./audit";
import { deltaE, type ColorRecord } from "./palette/distance";
import { THRESHOLDS } from "./constraints";

interface Warning {
  severity: "error" | "warn" | "info";
  title: string;
  detail: string;
}

export interface VariantBlock {
  kind: ChartKind;
  family: "categorical" | "sequential" | "diverging";
  posture: string;
  theme: "light" | "dark";
  n: number;
  requestedN: number;
  rule: BestPractice;
  option: Record<string, unknown>;
  warnings: Warning[];
  audit: AuditReport;
  auditedColors: ColorRecord[];
  background: ColorRecord;
}

export interface ExportComparisonInput {
  kind: ChartKind;
  family: "categorical" | "sequential" | "diverging";
  posture: string;
  theme: "light" | "dark";
  vision: VisionMode;
  n: number;
  requestedN: number;
  rule: BestPractice;
  option: Record<string, unknown>;
  warnings: Warning[];
  audit: AuditReport;
  auditedColors: ColorRecord[];
  background: ColorRecord;
  paletteVersion: string;
  /** Compare-mode normal-vision Variant B. Triggers the A-vs-B layout. */
  variantB?: VariantBlock;
}

const VISION_FILTER: Record<VisionMode, string> = {
  normal: "none",
  deutan: "url(#cvd-deutan)",
  protan: "url(#cvd-protan)",
  tritan: "url(#cvd-tritan)",
  achromatopsia: "grayscale(1)",
};

const SVG_FILTERS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="cvd-deutan"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"/></filter>
    <filter id="cvd-protan"><feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0"/></filter>
    <filter id="cvd-tritan"><feColorMatrix type="matrix" values="1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0"/></filter>
  </defs>
</svg>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

function scoreRows(colors: ColorRecord[], vision: VisionMode, bg: ColorRecord) {
  const sim = colors.map((c) => simulateColor(c, vision));
  const cvdT =
    vision === "achromatopsia" ? THRESHOLDS.minDeltaL * 100 : THRESHOLDS.minDeltaECvd;
  return colors.map((c, i) => {
    let wn = Infinity;
    let ws = Infinity;
    for (let j = 0; j < colors.length; j++) {
      if (j === i) continue;
      wn = Math.min(wn, deltaE(c, colors[j]));
      ws = Math.min(ws, deltaE(sim[i], sim[j]));
    }
    const cn = contrastRatio(c, bg);
    const cs = contrastRatio(sim[i], bg);
    return {
      i,
      normalHex: c.hex,
      simHex: sim[i].hex,
      cn,
      cs,
      cnPass: cn >= 3,
      csPass: cs >= 3,
      dn: colors.length < 2 ? Infinity : wn,
      ds: colors.length < 2 ? Infinity : ws,
      dnPass: colors.length < 2 || wn >= THRESHOLDS.minDeltaENormal,
      dsPass: colors.length < 2 || ws >= cvdT,
      cvdT,
    };
  });
}

function normalScoreRows(colors: ColorRecord[], bg: ColorRecord) {
  return colors.map((c, i) => {
    let w = Infinity;
    for (let j = 0; j < colors.length; j++) {
      if (j === i) continue;
      w = Math.min(w, deltaE(c, colors[j]));
    }
    const con = contrastRatio(c, bg);
    return {
      i,
      hex: c.hex,
      contrast: con,
      contrastPass: con >= 3,
      delta: colors.length < 2 ? Infinity : w,
      deltaPass: colors.length < 2 || w >= THRESHOLDS.minDeltaENormal,
    };
  });
}

function renderWarnings(ws: Warning[]): string {
  if (ws.length === 0) {
    return `<div class="ok">✓ No warnings at the current chart type and N.</div>`;
  }
  return ws
    .map(
      (w) => `
    <div class="warn warn-${w.severity}">
      <div class="warn-title">${w.severity === "error" ? "✗" : w.severity === "warn" ? "⚠" : "ℹ"} ${escapeHtml(w.title)}</div>
      <div class="warn-detail">${escapeHtml(w.detail)}</div>
    </div>`
    )
    .join("");
}

function renderVisionAudit(audit: AuditReport): string {
  return audit.perVision
    .map(
      (v) => `
    <tr>
      <td>${v.mode}</td>
      <td class="num ${v.pass ? "pass" : "fail"}">${Number.isFinite(v.minDeltaE) ? v.minDeltaE.toFixed(1) : "—"}</td>
      <td class="num">≥ ${v.threshold.toFixed(0)}</td>
      <td class="${v.pass ? "pass" : "fail"}">${v.pass ? "PASS" : "FAIL"}</td>
    </tr>`
    )
    .join("");
}

function renderNormalScorecard(rows: ReturnType<typeof normalScoreRows>): string {
  return rows
    .map((r) => {
      const pass = r.contrastPass && r.deltaPass;
      return `
      <tr>
        <td>#${r.i}</td>
        <td><span class="sw" style="background:${r.hex}"></span></td>
        <td class="num ${r.contrastPass ? "pass" : "fail"}">${r.contrast.toFixed(2)}:1</td>
        <td class="num ${r.deltaPass ? "pass" : "fail"}">${Number.isFinite(r.delta) ? r.delta.toFixed(1) : "—"}</td>
        <td>${pass ? `<span class="pass">✓ pass</span>` : `<span class="fail">✗ fails</span>`}</td>
      </tr>`;
    })
    .join("");
}

function renderSwatches(colors: ColorRecord[]): string {
  return colors
    .map(
      (c, i) => `
      <div class="swatch-cell">
        <div class="sw-lg" style="background:${c.hex}"></div>
        <div class="swatch-label">#${i} ${escapeHtml(c.hex)}</div>
      </div>`
    )
    .join("");
}

function summaryTilesHtml(audit: AuditReport, warnings: Warning[]): string {
  return `
  <div class="summary">
    <div class="cell"><div class="label">Overall</div><div class="value ${audit.overall === "pass" ? "pass" : audit.overall === "fail" ? "fail" : ""}">${audit.overall.toUpperCase()}</div></div>
    <div class="cell"><div class="label">Worst contrast vs. bg</div><div class="value ${audit.bgPass ? "pass" : "fail"}">${audit.worstContrastVsBg.toFixed(2)}:1</div></div>
    <div class="cell"><div class="label">Vision modes failing</div><div class="value">${audit.perVision.filter((v) => !v.pass).length} / ${audit.perVision.length}</div></div>
    <div class="cell"><div class="label">Warnings</div><div class="value">${warnings.length}</div></div>
  </div>`;
}

function variantSectionHtml(label: string, v: VariantBlock): string {
  const rows = normalScoreRows(v.auditedColors, v.background);
  return `
  <section class="variant">
    <h3 class="variant-title">${escapeHtml(label)} — ${escapeHtml(CHART_KIND_LABEL[v.kind])}</h3>
    <div class="variant-meta">
      ${v.family} palette · posture <strong>${escapeHtml(v.posture)}</strong> · theme ${v.theme} · N=${v.n}${
    v.requestedN > v.n ? ` (requested ${v.requestedN}, capped)` : ""
  } · bg <code>${escapeHtml(v.background.hex)}</code>
    </div>
    <div class="variant-meta" style="margin-top:2px;">${escapeHtml(v.rule.rationale)}</div>

    ${summaryTilesHtml(v.audit, v.warnings)}

    <h4>Warnings</h4>
    ${renderWarnings(v.warnings)}

    <h4>Per-vision ΔE audit</h4>
    <table>
      <thead><tr><th>Vision</th><th>min ΔE</th><th>Threshold</th><th>Result</th></tr></thead>
      <tbody>${renderVisionAudit(v.audit)}</tbody>
    </table>

    <h4>Per-series readability (normal vision)</h4>
    <table>
      <thead><tr><th>Slot</th><th>Color</th><th>Contrast</th><th>Worst ΔE</th><th>Verdict</th></tr></thead>
      <tbody>${renderNormalScorecard(rows)}</tbody>
    </table>

    <h4>Palette swatches</h4>
    <div class="swatch-grid">${renderSwatches(v.auditedColors)}</div>
  </section>`;
}

const SHARED_STYLES = (
  bgHex: string,
  fg: string,
  muted: string,
  border: string,
  surface: string,
  positive: string,
  negative: string,
  isDark: boolean,
  filterVision: string
) => `
:root {
  --bg: ${bgHex};
  --fg: ${fg};
  --muted: ${muted};
  --border: ${border};
  --surface: ${surface};
  --pass: ${positive};
  --fail: ${negative};
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--surface);
  color: var(--fg);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  padding: 32px;
  max-width: 1280px;
  margin: 0 auto;
}
header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
header h1 { font-size: 22px; margin: 0; }
header .meta { color: var(--muted); font-size: 11px; text-align: right; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 28px 0 8px; }
h3.variant-title { font-size: 15px; margin: 0 0 4px; }
.variant-meta { color: var(--muted); font-size: 11px; }
h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 16px 0 6px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.toolbar button {
  background: var(--fg); color: var(--surface); border: 0; border-radius: 4px;
  padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
}
@media print { .toolbar { display: none; } body { padding: 16px; max-width: none; } }
.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 8px; }
.summary .cell { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; }
.summary .label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.summary .value { font-size: 14px; font-weight: 600; margin-top: 2px; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.chart-card { border: 1px solid var(--border); border-radius: 6px; padding: 10px; background: ${bgHex}; }
.chart-card h3 { margin: 0 0 6px; font-size: 12px; color: ${isDark ? "#9aa1a8" : "#57606a"}; }
.chart-host { width: 100%; height: 360px; }
.chart-host.simulated { filter: ${filterVision}; }
.variants { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.variant { min-width: 0; }
@media (max-width: 900px) { .variants, .charts, .summary { grid-template-columns: 1fr; } }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 500; font-size: 11px; }
td.num { font-variant-numeric: tabular-nums; }
.pass { color: var(--pass); font-weight: 600; }
.fail { color: var(--fail); font-weight: 600; }
.ok { color: var(--pass); padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; }
.warn { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; }
.warn-title { font-weight: 600; }
.warn-error .warn-title { color: var(--fail); }
.warn-warn .warn-title { color: #9a6700; }
.warn-info .warn-title { color: var(--muted); }
.warn-detail { color: var(--muted); font-size: 11px; margin-top: 2px; }
.sw { display: inline-block; width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--border); vertical-align: middle; }
.swatch-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.swatch-cell { border: 1px solid var(--border); border-radius: 4px; overflow: hidden; font-size: 9px; text-align: center; min-width: 56px; }
.sw-lg { width: 56px; height: 22px; display: block; }
.swatch-label { padding: 2px 4px; color: var(--muted); }
footer { margin-top: 24px; color: var(--muted); font-size: 10px; text-align: center; }
code { background: ${isDark ? "#1c2128" : "#f6f8fa"}; padding: 1px 4px; border-radius: 3px; }
`;

function openOrDownload(html: string, filename: string): void {
  const w = window.open("", "_blank");
  if (!w) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function exportComparisonReport(input: ExportComparisonInput): void {
  const {
    kind,
    family,
    posture,
    theme,
    vision,
    n,
    requestedN,
    rule,
    option,
    warnings,
    audit,
    auditedColors,
    background,
    paletteVersion,
    variantB,
  } = input;

  const generatedAt = new Date().toISOString();
  const bgHex = background.hex;
  const isDark = theme === "dark";
  const fg = isDark ? "#e6e8eb" : "#0b0d10";
  const muted = isDark ? "#7d8590" : "#57606a";
  const border = isDark ? "#262b30" : "#d0d7de";
  const surface = isDark ? "#0f1419" : "#ffffff";
  const positive = "#1a7f37";
  const negative = "#cf222e";

  // ---------- A vs. B layout ----------
  if (variantB) {
    const titleText = `${CHART_KIND_LABEL[kind]} vs. ${CHART_KIND_LABEL[variantB.kind]} — A vs. B`;
    const styles = SHARED_STYLES(bgHex, fg, muted, border, surface, positive, negative, isDark, "none");
    const variantA: VariantBlock = {
      kind, family, posture, theme, n, requestedN, rule, option, warnings, audit, auditedColors, background,
    };

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titleText)} — comparison report</title>
<style>${styles}</style>
</head>
<body>
${SVG_FILTERS}
<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
</div>
<header>
  <div>
    <h1>${escapeHtml(titleText)}</h1>
    <div style="color:var(--muted); font-size:11px; margin-top:2px;">
      Side-by-side comparison of two normal-vision configurations.
    </div>
  </div>
  <div class="meta">
    Palette v${escapeHtml(paletteVersion)}<br/>
    Generated ${escapeHtml(generatedAt)}
  </div>
</header>

<h2>Charts (normal vision)</h2>
<div class="charts">
  <div class="chart-card">
    <h3>A · ${escapeHtml(CHART_KIND_LABEL[kind])}</h3>
    <div id="chart-a" class="chart-host"></div>
  </div>
  <div class="chart-card" style="background:${variantB.background.hex}">
    <h3>B · ${escapeHtml(CHART_KIND_LABEL[variantB.kind])}</h3>
    <div id="chart-b" class="chart-host"></div>
  </div>
</div>

<h2>Per-variant metrics</h2>
<div class="variants">
  ${variantSectionHtml("A", variantA)}
  ${variantSectionHtml("B", variantB)}
</div>

<footer>
  Generated by Micah's Chart System for Sane and Useful Color Strategies · contrast threshold WCAG 2.2 SC 1.4.11 (≥ 3:1) · ΔE in OKLab ×100 · CVD via Machado matrices.
</footer>

<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script>
  (function () {
    var oA = ${JSON.stringify(option).replace(/</g, "\\u003c")};
    var oB = ${JSON.stringify(variantB.option).replace(/</g, "\\u003c")};
    function render(id, opt) {
      var el = document.getElementById(id);
      if (!el || !window.echarts) return;
      var chart = window.echarts.init(el, null, { renderer: "canvas" });
      chart.setOption(opt);
      window.addEventListener("resize", function () { chart.resize(); });
    }
    render("chart-a", oA);
    render("chart-b", oB);
  })();
</script>
</body>
</html>`;
    openOrDownload(html, `chart-comparison-${kind}-vs-${variantB.kind}.html`);
    return;
  }

  // ---------- Single-variant CVD-simulation layout (original) ----------
  const rows = scoreRows(auditedColors, vision, background);
  const sim = auditedColors.map((c) => simulateColor(c, vision));
  const titleText = `${CHART_KIND_LABEL[kind]} — normal vs. ${vision}`;
  const styles = SHARED_STYLES(bgHex, fg, muted, border, surface, positive, negative, isDark, VISION_FILTER[vision]);

  const scorecardHtml = rows
    .map((r) => {
      const allPass = r.cnPass && r.csPass && r.dnPass && r.dsPass;
      const degraded = (r.cnPass && !r.csPass) || (r.dnPass && !r.dsPass);
      const verdict = allPass
        ? `<span class="pass">✓ pass</span>`
        : degraded
        ? `<span class="fail">⚠ degrades under ${vision}</span>`
        : `<span class="fail">✗ fails</span>`;
      return `
      <tr>
        <td>#${r.i}</td>
        <td><span class="sw" style="background:${r.normalHex}"></span></td>
        <td><span class="sw" style="background:${r.simHex}"></span></td>
        <td class="num ${r.cnPass ? "pass" : "fail"}">${r.cn.toFixed(2)}:1</td>
        <td class="num ${r.csPass ? "pass" : "fail"}">${r.cs.toFixed(2)}:1</td>
        <td class="num ${r.dnPass ? "pass" : "fail"}">${Number.isFinite(r.dn) ? r.dn.toFixed(1) : "—"}</td>
        <td class="num ${r.dsPass ? "pass" : "fail"}">${Number.isFinite(r.ds) ? r.ds.toFixed(1) : "—"}</td>
        <td>${verdict}</td>
      </tr>`;
    })
    .join("");

  const swatchesCvd = auditedColors
    .map(
      (c, i) => `
      <div class="swatch-cell">
        <div class="sw-lg" style="background:${c.hex}"></div>
        <div class="sw-lg" style="background:${sim[i].hex}"></div>
        <div class="swatch-label">#${i}</div>
      </div>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titleText)} — comparison report</title>
<style>${styles}</style>
</head>
<body>
${SVG_FILTERS}
<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
</div>
<header>
  <div>
    <h1>${escapeHtml(titleText)}</h1>
    <div style="color:var(--muted); font-size:11px; margin-top:2px;">
      ${escapeHtml(CHART_KIND_LABEL[kind])} · ${family} palette · posture <strong>${posture}</strong> · theme ${theme} · N=${n}${
    requestedN > n ? ` (requested ${requestedN}, capped)` : ""
  }
    </div>
    <div style="color:var(--muted); font-size:11px; margin-top:2px;">${escapeHtml(rule.rationale)}</div>
  </div>
  <div class="meta">
    Palette v${escapeHtml(paletteVersion)}<br/>
    Generated ${escapeHtml(generatedAt)}
  </div>
</header>

<h2>Accessibility summary</h2>
${summaryTilesHtml(audit, warnings)}

<h2>Charts</h2>
<div class="charts">
  <div class="chart-card">
    <h3>Normal vision</h3>
    <div id="chart-normal" class="chart-host"></div>
  </div>
  <div class="chart-card">
    <h3>Preview as ${vision}</h3>
    <div id="chart-sim" class="chart-host simulated"></div>
  </div>
</div>

<h2>Warnings</h2>
${renderWarnings(warnings)}

<h2>Per-vision ΔE audit</h2>
<table>
  <thead><tr><th>Vision</th><th>min ΔE</th><th>Threshold</th><th>Result</th></tr></thead>
  <tbody>${renderVisionAudit(audit)}</tbody>
</table>

<h2>Per-series readability — normal vs. ${vision}</h2>
<table>
  <thead>
    <tr>
      <th rowspan="2">Slot</th>
      <th colspan="2">Color</th>
      <th colspan="2">Contrast vs. bg</th>
      <th colspan="2">Worst ΔE vs. others</th>
      <th rowspan="2">Verdict</th>
    </tr>
    <tr>
      <th>normal</th><th>${vision}</th>
      <th>normal</th><th>${vision}</th>
      <th>normal</th><th>${vision}</th>
    </tr>
  </thead>
  <tbody>${scorecardHtml}</tbody>
</table>

<h2>Palette swatches (normal · simulated)</h2>
<div class="swatch-grid">${swatchesCvd}</div>

<footer>
  Generated by Micah's Chart System for Sane and Useful Color Strategies · contrast threshold WCAG 2.2 SC 1.4.11 (≥ 3:1) · ΔE in OKLab ×100 · CVD via Machado matrices.
</footer>

<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script>
  (function () {
    var option = ${JSON.stringify(option).replace(/</g, "\\u003c")};
    function render(id) {
      var el = document.getElementById(id);
      if (!el || !window.echarts) return;
      var chart = window.echarts.init(el, null, { renderer: "canvas" });
      chart.setOption(option);
      window.addEventListener("resize", function () { chart.resize(); });
    }
    render("chart-normal");
    render("chart-sim");
  })();
</script>
</body>
</html>`;

  openOrDownload(html, `chart-comparison-${kind}-${vision}.html`);
}
