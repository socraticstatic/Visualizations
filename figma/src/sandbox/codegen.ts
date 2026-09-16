/**
 * Dev Mode entry point. Runs in the sandbox with no DOM, on a 15 second budget.
 */
import {
  echartsOption,
  cssTokens,
  paletteJson,
  collectSeries,
  MAX_CODEGEN_NODES,
} from "../shared/codegen";

type Loose = Record<string, any>;

const toHex = (c: { r: number; g: number; b: number }) => {
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
};

function firstOpaqueSolid(node: Loose): string | null {
  const fills = node.fills;
  if (!Array.isArray(fills)) return null;
  for (const p of fills) {
    if (p?.type === "SOLID" && p.visible !== false && (p.opacity ?? 1) >= 1) return toHex(p.color);
  }
  return null;
}

/** Every node carrying an opaque solid fill, in document order. */
function collectFilled(root: Loose): Array<{ name: unknown; hex: string }> {
  const out: Array<{ name: unknown; hex: string }> = [];
  const visit = (node: Loose) => {
    if (node !== root) {
      const hex = firstOpaqueSolid(node);
      if (hex) out.push({ name: node.name, hex });
    }
    const kids = node.children;
    if (Array.isArray(kids)) kids.forEach(visit);
  };
  visit(root);
  return out;
}

export function registerCodegen(): void {
  figma.codegen.on("generate", (event) => {
    const node = event.node as unknown as Loose;
    const { series, found, tooMany } = collectSeries(collectFilled(node));
    const surface = firstOpaqueSolid(node);

    if (tooMany) {
      return [
        {
          title: "Chart Color System",
          language: "PLAINTEXT" as const,
          code:
            `This selection has ${found} filled nodes, past the ${MAX_CODEGEN_NODES} this reads as a\n` +
            "set of series. That usually means a chart was pasted as vectors, where\n" +
            "every point is its own path.\n\n" +
            "Select the legend swatches, or one shape per series, and this will read\n" +
            "them in order.",
        },
      ];
    }

    if (series.length === 0) {
      return [
        {
          title: "Chart Color System",
          language: "PLAINTEXT" as const,
          code:
            "No opaque solid fills found in this selection.\n\n" +
            "Select the chart frame itself, or a group whose children carry one\n" +
            "solid fill per series. Image and gradient fills are skipped: a series\n" +
            "colour cannot be read from them.",
        },
      ];
    }

    const input = { series, surface };
    return [
      { title: "ECharts option", language: "TYPESCRIPT" as const, code: echartsOption(input) },
      { title: "CSS tokens", language: "CSS" as const, code: cssTokens(input) },
      { title: "Palette JSON", language: "JSON" as const, code: paletteJson(input) },
    ];
  });
}
