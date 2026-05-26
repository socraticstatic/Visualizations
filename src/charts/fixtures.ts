/**
 * Realistic chart fixtures.
 *
 * Two modes per generator:
 *
 *   - "synthetic"  Smooth, evenly spaced, no missing values, no ties, no
 *                  outliers. Looks pretty, hides palette weaknesses.
 *   - "messy"      Long-tail distributions, near-zero series, ties, missing
 *                  segments, outliers. Closer to real dashboards — this is
 *                  where palettes break (small legible-size slots collapse,
 *                  near-zero stacks vanish, near-tie categories become
 *                  indistinguishable).
 *
 * Both modes are deterministic via a seeded PRNG so the same configuration
 * always renders the same fixture.
 */

export type DataMode = "synthetic" | "messy";

// mulberry32 — small, fast, deterministic.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERIES_NAMES = [
  "Acme",
  "Globex",
  "Initech",
  "Umbrella",
  "Hooli",
  "Soylent",
  "Wonka",
  "Cyberdyne",
  "Massive Dynamic",
  "Stark",
  "Tyrell",
  "Wayne",
];

export interface LineSeries {
  name: string;
  data: Array<[number, number | null]>;
}

export function genLineData(n: number, mode: DataMode = "synthetic", points = 24): LineSeries[] {
  if (mode === "synthetic") {
    return Array.from({ length: n }, (_, i) => {
      const seed = i * 13;
      const data: Array<[number, number]> = Array.from({ length: points }, (_, j) => {
        const v = 50 + 30 * Math.sin((j + seed) / 4) + 20 * Math.cos((j + seed) / 7) + i * 6;
        return [j, Math.round(v)];
      });
      return { name: SERIES_NAMES[i], data };
    });
  }
  // Messy: long-tail magnitudes, occasional nulls, one near-zero series,
  // one spiky outlier series.
  return Array.from({ length: n }, (_, i) => {
    const r = rng(0xf17 + i * 97);
    // Long-tail: series magnitude scales by 1 / (i+1) — first series dominates.
    const scale = 100 / (i + 1);
    const isNearZero = i === Math.min(n - 1, 3); // a "dead" series
    const isSpiky = i === 1 && n >= 3;
    const data: Array<[number, number | null]> = Array.from({ length: points }, (_, j) => {
      if (r() < 0.06) return [j, null]; // ~6% missing
      const base = isNearZero
        ? 0.5 + r() * 1.5
        : scale * (0.4 + 0.6 * Math.sin((j + i * 5) / 3.5));
      const spike = isSpiky && r() < 0.08 ? scale * 3 : 0;
      const noise = (r() - 0.5) * scale * 0.25;
      return [j, Math.round(base + spike + noise)];
    });
    return { name: SERIES_NAMES[i], data };
  });
}

export interface StackedData {
  categories: string[];
  series: Array<{ name: string; stack: string; data: number[] }>;
}

export function genStackedData(n: number, mode: DataMode = "synthetic"): StackedData {
  const cats = ["Q1", "Q2", "Q3", "Q4"];
  if (mode === "synthetic") {
    const r = rng(42);
    return {
      categories: cats,
      series: Array.from({ length: n }, (_, i) => ({
        name: SERIES_NAMES[i],
        stack: "total",
        data: cats.map((_, j) => 20 + Math.round(20 * r()) + i * 3 + j * 2),
      })),
    };
  }
  // Messy: a few near-zero segments (will visually vanish under tight ΔE),
  // one dominant series, ties between two middle series.
  const r = rng(0xc0ffee);
  return {
    categories: cats,
    series: Array.from({ length: n }, (_, i) => ({
      name: SERIES_NAMES[i],
      stack: "total",
      data: cats.map((_, j) => {
        if (i === 0) return 80 + Math.round(20 * r()); // dominant
        if (i === n - 1) return 1 + Math.round(2 * r()); // near-zero tail
        // Middle series — two of them tied in value to stress legibility.
        const tieBucket = Math.floor(i / 2);
        return 12 + tieBucket * 4 + Math.round(2 * r()) + (j % 2);
      }),
    })),
  };
}

export interface HeatmapData {
  days: string[];
  hours: string[];
  data: Array<[number, number, number | "-"]>;
}

export function genHeatmap(mode: DataMode = "synthetic"): HeatmapData {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 12 }, (_, i) => `${i * 2}:00`);
  const data: Array<[number, number, number | "-"]> = [];
  const r = rng(mode === "synthetic" ? 7 : 0xbadcafe);
  for (let d = 0; d < days.length; d++) {
    for (let h = 0; h < hours.length; h++) {
      if (mode === "messy" && r() < 0.08) {
        data.push([h, d, "-"]); // missing cell
        continue;
      }
      const base = mode === "synthetic"
        ? 50 + 40 * Math.sin(h / 2 + d) + 20 * r()
        // Messy: heavy concentration in 2 hot spots, long tail elsewhere.
        : 5 + 90 * Math.exp(-((h - 9) ** 2 + (d - 2) ** 2) / 6)
            + 70 * Math.exp(-((h - 3) ** 2 + (d - 5) ** 2) / 4)
            + r() * 8;
      data.push([h, d, Math.round(base)]);
    }
  }
  return { days, hours, data };
}

export interface DivergingItem { name: string; value: number; }

export function genDiverging(mode: DataMode = "synthetic"): DivergingItem[] {
  const cats = ["North", "South", "East", "West", "Central", "Pacific"];
  const r = rng(mode === "synthetic" ? 99 : 0xdeadbeef);
  if (mode === "synthetic") {
    return cats.map((c) => ({ name: c, value: Math.round((r() - 0.5) * 80) }));
  }
  // Messy: one extreme outlier dominates the scale; a few near-zero (which
  // will collapse to the diverging midpoint and become indistinguishable).
  return cats.map((c, i) => {
    if (i === 0) return { name: c, value: 95 }; // outlier high
    if (i === cats.length - 1) return { name: c, value: -88 }; // outlier low
    if (i === 2 || i === 3) return { name: c, value: Math.round((r() - 0.5) * 4) }; // near zero
    return { name: c, value: Math.round((r() - 0.5) * 30) };
  });
}


