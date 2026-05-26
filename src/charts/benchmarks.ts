/**
 * Published categorical palettes used as side-by-side benchmarks.
 *
 * Sources (hexes copied verbatim from each system's public spec, then trimmed
 * to the first N slots when N < palette length):
 *   - Tableau 10              — Tableau Desktop default categorical (10)
 *   - IBM Carbon Categorical  — Carbon Charts categorical-14 (first 10)
 *   - ColorBrewer Set2        — qualitative Set2 (8)
 *   - Material Design 2014    — primary 500s, picked for high pairwise ΔE (10)
 *   - Observable Plot Tab10   — Plot's "tableau10" interpreter (10)
 *
 * Every palette is rendered against the *current chart background* so contrast
 * verdicts reflect the user's own theme — not the originating system's.
 */
import { fromCss, deltaE, type ColorRecord } from "./palette/distance";
import { contrastRatio, simulateColor, type VisionMode } from "./audit";
import { THRESHOLDS } from "./constraints";

export interface Benchmark {
  id: string;
  name: string;
  source: string;
  hexes: string[];
}

export const BENCHMARKS: Benchmark[] = [
  {
    id: "tableau10",
    name: "Tableau 10",
    source: "Tableau Desktop default",
    hexes: [
      "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
      "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
    ],
  },
  {
    id: "carbon",
    name: "IBM Carbon",
    source: "Carbon Charts categorical-14",
    hexes: [
      "#6929C4", "#1192E8", "#005D5D", "#9F1853", "#FA4D56",
      "#570408", "#198038", "#002D9C", "#EE538B", "#B28600",
    ],
  },
  {
    id: "set2",
    name: "ColorBrewer Set2",
    source: "qualitative Set2",
    hexes: [
      "#66C2A5", "#FC8D62", "#8DA0CB", "#E78AC3", "#A6D854",
      "#FFD92F", "#E5C494", "#B3B3B3",
    ],
  },
  {
    id: "tab10",
    name: "Observable Plot tab10",
    source: "Plot scheme",
    hexes: [
      "#4269D0", "#EFB118", "#FF725C", "#6CC5B0", "#3CA951",
      "#FF8AB7", "#A463F2", "#97BBF5", "#9C6B4E", "#9498A0",
    ],
  },
  {
    id: "material",
    name: "Material 500",
    source: "Material Design primaries",
    hexes: [
      "#1976D2", "#D32F2F", "#388E3C", "#F57C00", "#7B1FA2",
      "#00796B", "#FBC02D", "#5D4037", "#455A64", "#C2185B",
    ],
  },
];

export interface BenchmarkScore {
  id: string;
  name: string;
  source: string;
  n: number;
  colors: ColorRecord[];
  minDeltaE: number;
  worstCvdDeltaE: number;
  cvdMode: VisionMode;
  worstContrast: number;
  passNormal: boolean;
  passCvd: boolean;
  passContrast: boolean;
}

const CVD_MODES: VisionMode[] = ["deutan", "protan", "tritan"];

export function scoreColors(colors: ColorRecord[], background: ColorRecord): Omit<BenchmarkScore, "id" | "name" | "source"> {
  let minDe = Infinity;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      minDe = Math.min(minDe, deltaE(colors[i], colors[j]));
    }
  }
  let worstCvd = Infinity;
  let cvdMode: VisionMode = "deutan";
  for (const m of CVD_MODES) {
    const sim = colors.map((c) => simulateColor(c, m));
    let m_min = Infinity;
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        m_min = Math.min(m_min, deltaE(sim[i], sim[j]));
      }
    }
    if (m_min < worstCvd) {
      worstCvd = m_min;
      cvdMode = m;
    }
  }
  let worstContrast = Infinity;
  for (const c of colors) {
    worstContrast = Math.min(worstContrast, contrastRatio(c, background));
  }
  return {
    n: colors.length,
    colors,
    minDeltaE: minDe === Infinity ? 0 : minDe,
    worstCvdDeltaE: worstCvd === Infinity ? 0 : worstCvd,
    cvdMode,
    worstContrast: worstContrast === Infinity ? 0 : worstContrast,
    passNormal: minDe >= THRESHOLDS.minDeltaENormal,
    passCvd: worstCvd >= THRESHOLDS.minDeltaECvd,
    passContrast: worstContrast >= 3,
  };
}

export function scoreBenchmarks(n: number, background: ColorRecord): BenchmarkScore[] {
  return BENCHMARKS.map((b) => {
    const take = Math.min(n, b.hexes.length);
    const colors = b.hexes.slice(0, take).map(fromCss);
    return { id: b.id, name: b.name, source: b.source, ...scoreColors(colors, background) };
  });
}
