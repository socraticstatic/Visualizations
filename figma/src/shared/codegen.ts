/**
 * Dev Mode output.
 *
 * The seam this whole system exists to close is designer to developer: a
 * palette gets audited in one tool and retyped by hand in another. Codegen
 * removes the retyping. A developer selects the chart frame in Dev Mode and
 * receives the option object with the exact colours, dashes, decals and marker
 * shapes the designer approved.
 *
 * Pure. This runs in the sandbox, which has no DOM, so nothing here may touch
 * one. It also deliberately does not import the app's snippet emitter, which
 * reads chart tokens off a live element.
 */
import { dashScale, decalScale, shapeScale, MAX_SLOTS } from "@engine/encoding";
import { MAX_CODEGEN_NODES } from "./limits";
import { PALETTE_VERSION } from "@engine/version";

export interface CodegenSeries {
  /** Layer name, used as the series name when it is meaningful. */
  name: string;
  hex: string;
}

export interface CodegenInput {
  series: CodegenSeries[];
  surface: string | null;
}

export { MAX_CODEGEN_NODES };

export interface CollectResult {
  series: CodegenSeries[];
  /** Filled nodes found, before the slot cap. */
  found: number;
  tooMany: boolean;
}

interface FilledNode {
  name?: unknown;
  hex: string;
}

/**
 * Series in document order.
 *
 * Deliberately does NOT de-duplicate by colour: two series may legitimately
 * share one, and collapsing them silently renumbers every slot after the
 * collision, which would hand a developer the wrong dash for the wrong series.
 * The slot cap is the encoding scales' length, because past that there is no
 * dash or shape left to assign.
 */
export function collectSeries(filled: FilledNode[]): CollectResult {
  const found = filled.length;
  if (found > MAX_CODEGEN_NODES) return { series: [], found, tooMany: true };
  return {
    series: filled.slice(0, MAX_SLOTS).map((f) => ({ name: String(f.name ?? ""), hex: f.hex })),
    found,
    tooMany: false,
  };
}

const clean = (s: string) => s.replace(/[^A-Za-z0-9 _-]/g, "").trim();

/** Layer names are often "Rectangle 12"; fall back to a slot label. */
function seriesName(s: CodegenSeries, i: number): string {
  const c = clean(s.name);
  const generic = /^(rectangle|ellipse|frame|group|vector|line|polygon|star)\b/i.test(c);
  return !c || generic ? `Series ${i + 1}` : c;
}

function dashLiteral(slot: number): string {
  const d = dashScale[slot % dashScale.length];
  return d === "solid" ? '"solid"' : `[${d.join(", ")}]`;
}

function decalLiteral(slot: number): string {
  const d = decalScale[slot % decalScale.length];
  if (d.symbol === "none") return "undefined";
  const parts = [`symbol: "${d.symbol}"`, `rotation: ${d.rotation.toFixed(4)}`, `symbolSize: ${d.symbolSize}`];
  if (d.dashArrayX) parts.push(`dashArrayX: [${d.dashArrayX.join(", ")}]`);
  if (d.dashArrayY) parts.push(`dashArrayY: [${d.dashArrayY.join(", ")}]`);
  return `{ ${parts.join(", ")} }`;
}

const header = (n: number) =>
  `// Chart Color System v${PALETTE_VERSION} - ${n} slot${n === 1 ? "" : "s"}\n` +
  `// Colour is one of four channels. Dash, decal and marker shape carry identity\n` +
  `// when colour cannot: colour-vision deficiency, greyscale print, projectors.\n`;

/** An ECharts option fragment with every channel applied per slot. */
export function echartsOption(input: CodegenInput): string {
  const n = Math.min(input.series.length, MAX_SLOTS);
  const slots = input.series.slice(0, n);

  const series = slots
    .map((s, i) => {
      const name = seriesName(s, i);
      return [
        `  {`,
        `    name: ${JSON.stringify(name)},`,
        `    type: "line",`,
        `    symbol: "${shapeScale[i % shapeScale.length]}",`,
        `    symbolSize: 8,`,
        `    itemStyle: { color: "${s.hex}", decal: ${decalLiteral(i)} },`,
        `    lineStyle: { color: "${s.hex}", type: ${dashLiteral(i)} },`,
        `  },`,
      ].join("\n");
    })
    .join("\n");

  return (
    header(n) +
    `export const option = {\n` +
    (input.surface ? `  backgroundColor: "${input.surface}",\n` : "") +
    `  series: [\n${series}\n  ],\n};\n`
  );
}

/** The same palette as design tokens, for teams not on ECharts. */
export function cssTokens(input: CodegenInput): string {
  const n = Math.min(input.series.length, MAX_SLOTS);
  const lines = input.series.slice(0, n).flatMap((s, i) => {
    const d = dashScale[i % dashScale.length];
    return [
      `  --chart-series-${i + 1}-color: ${s.hex};`,
      `  --chart-series-${i + 1}-dash: ${d === "solid" ? "none" : d.join(" ")};`,
      `  --chart-series-${i + 1}-shape: ${shapeScale[i % shapeScale.length]};`,
    ];
  });
  const surface = input.surface ? [`  --chart-surface: ${input.surface};`] : [];
  return `/* Chart Color System v${PALETTE_VERSION} */\n:root {\n${[...surface, ...lines].join("\n")}\n}\n`;
}

/** Machine-readable, for pipelines that generate their own bindings. */
export function paletteJson(input: CodegenInput): string {
  const n = Math.min(input.series.length, MAX_SLOTS);
  return JSON.stringify(
    {
      version: PALETTE_VERSION,
      surface: input.surface,
      slots: input.series.slice(0, n).map((s, i) => ({
        slot: i + 1,
        name: seriesName(s, i),
        color: s.hex,
        dash: dashScale[i % dashScale.length],
        decal: decalScale[i % decalScale.length],
        shape: shapeScale[i % shapeScale.length],
      })),
    },
    null,
    2
  );
}
