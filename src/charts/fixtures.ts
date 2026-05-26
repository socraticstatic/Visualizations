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

// ---------------------------------------------------------------------------
// Scatter / bubble
// ---------------------------------------------------------------------------

export interface ScatterSeries { name: string; data: Array<[number, number]>; }

export function genScatter(n: number, mode: DataMode = "synthetic"): ScatterSeries[] {
  const names = SERIES_NAMES.slice(0, n);
  if (mode === "synthetic") {
    // Each series is a compact elliptical cluster at a distinct (x, y) centre.
    return names.map((name, i) => {
      const r = rng(0xa1b2 + i * 31);
      const cx = 15 + (i % 4) * 22;
      const cy = 20 + Math.floor(i / 4) * 30;
      return {
        name,
        data: Array.from({ length: 18 }, (): [number, number] => [
          Math.round(cx + (r() - 0.5) * 16),
          Math.round(cy + (r() - 0.5) * 12),
        ]),
      };
    });
  }
  // Messy: one cluster is a giant outlier far from the pack; two clusters
  // nearly overlap (hard to distinguish by position alone); one series is
  // nearly a single point (all duplicates).
  return names.map((name, i) => {
    const r = rng(0xf00d + i * 53);
    if (i === 0) {
      // Outlier cluster — top-right corner.
      return {
        name,
        data: Array.from({ length: 18 }, (): [number, number] => [
          Math.round(85 + (r() - 0.5) * 10),
          Math.round(85 + (r() - 0.5) * 8),
        ]),
      };
    }
    if (i === 1 || i === 2) {
      // Near-overlapping pair — stress legibility.
      const cx = 30, cy = 30;
      const jitter = i === 2 ? 4 : 0;
      return {
        name,
        data: Array.from({ length: 18 }, (): [number, number] => [
          Math.round(cx + jitter + (r() - 0.5) * 14),
          Math.round(cy + jitter + (r() - 0.5) * 10),
        ]),
      };
    }
    if (i === n - 1 && n >= 4) {
      // Near-degenerate: all points in a tiny 2×2 box.
      return {
        name,
        data: Array.from({ length: 18 }, (): [number, number] => [
          Math.round(50 + (r() - 0.5) * 2),
          Math.round(50 + (r() - 0.5) * 2),
        ]),
      };
    }
    const cx = 15 + (i % 4) * 20;
    const cy = 55 + Math.floor(i / 4) * 18;
    return {
      name,
      data: Array.from({ length: 18 }, (): [number, number] => [
        Math.round(cx + (r() - 0.5) * 18),
        Math.round(cy + (r() - 0.5) * 14),
      ]),
    };
  });
}

export interface BubbleSeries { name: string; data: Array<[number, number, number]>; }

export function genBubble(n: number, mode: DataMode = "synthetic"): BubbleSeries[] {
  const names = SERIES_NAMES.slice(0, n);
  if (mode === "synthetic") {
    // Evenly sized bubbles, well separated.
    return names.map((name, i) => {
      const r = rng(0xb4b5 + i * 41);
      const cx = 12 + (i % 4) * 24;
      const cy = 20 + Math.floor(i / 4) * 35;
      return {
        name,
        data: Array.from({ length: 10 }, (): [number, number, number] => [
          Math.round(cx + (r() - 0.5) * 18),
          Math.round(cy + (r() - 0.5) * 22),
          8 + Math.round(r() * 10),
        ]),
      };
    });
  }
  // Messy: one giant bubble per series that dominates; many tiny bubbles
  // nearly invisible; one series with negative-magnitude overlap.
  return names.map((name, i) => {
    const r = rng(0xcafe + i * 67);
    const cx = 15 + (i % 4) * 23;
    const cy = 25 + Math.floor(i / 4) * 35;
    return {
      name,
      data: Array.from({ length: 10 }, (_, j): [number, number, number] => {
        const big = j === 0;
        return [
          Math.round(cx + (r() - 0.5) * 20),
          Math.round(cy + (r() - 0.5) * 24),
          big ? 28 + Math.round(r() * 10) : 1 + Math.round(r() * 4),
        ];
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------

export interface RadarItem { name: string; value: number[]; }

const RADAR_AXES = ["Speed", "Reliability", "Comfort", "Safety", "Efficiency", "Cost"] as const;

export function genRadar(n: number, mode: DataMode = "synthetic"): RadarItem[] {
  const names = SERIES_NAMES.slice(0, n);
  if (mode === "synthetic") {
    // Each series has a distinct "shape" — no two shapes are close.
    return names.map((name, i) => {
      const r = rng(0x5ca1 + i * 29);
      return {
        name,
        value: RADAR_AXES.map((_, j) => {
          // Phase-shift each series so shapes are clearly differentiated.
          const base = 40 + 40 * Math.abs(Math.sin((j + i * 2.1) / 1.8));
          return Math.min(100, Math.round(base + r() * 10));
        }),
      };
    });
  }
  // Messy: two adjacent series with nearly identical values (merge risk);
  // one series near-zero across all axes (invisible area fill).
  return names.map((name, i) => {
    const r = rng(0xd00d + i * 37);
    if (i === 0 || i === 1) {
      // Near-identical pair — stress legibility.
      const base = [65, 72, 58, 80, 61, 44];
      return { name, value: base.map((v) => Math.min(100, v + Math.round((r() - 0.5) * 6))) };
    }
    if (i === n - 1 && n >= 3) {
      // Near-zero — almost invisible area.
      return { name, value: RADAR_AXES.map(() => 4 + Math.round(r() * 8)) };
    }
    return {
      name,
      value: RADAR_AXES.map((_, j) => {
        return Math.min(100, Math.round(30 + 45 * Math.abs(Math.sin((j + i * 1.9) / 1.6)) + r() * 15));
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Treemap
// ---------------------------------------------------------------------------

export interface TreemapItem { name: string; value: number; }

export function genTreemapCategorical(n: number, mode: DataMode = "synthetic"): TreemapItem[] {
  const names = SERIES_NAMES.slice(0, n);
  if (mode === "synthetic") {
    const r = rng(0x7e7e + n);
    return names.map((name, i) => ({ name, value: 30 + Math.round(50 * r()) + i * 2 }));
  }
  // Messy: one tile dominates (~60% of total); several tiny tiles that
  // will shrink below label-legibility threshold.
  const r = rng(0x4da7 + n);
  return names.map((name, i) => {
    if (i === 0) return { name, value: 200 + Math.round(r() * 40) }; // dominant
    if (i >= n - 2) return { name, value: 3 + Math.round(r() * 5) }; // tiny tail
    return { name, value: 20 + Math.round(r() * 30) };
  });
}

export function genTreemapSequential(mode: DataMode = "synthetic"): Array<{ value: number }> {
  if (mode === "synthetic") {
    const r = rng(0x3c14);
    return Array.from({ length: 12 }, () => ({ value: 20 + Math.round(r() * 80) }));
  }
  // Messy: long-tail — one huge tile, many tiny ones.
  const r = rng(0x9e31);
  return Array.from({ length: 12 }, (_, i) => ({
    value: i === 0 ? 180 + Math.round(r() * 30) : 5 + Math.round(r() * 25),
  }));
}

// ---------------------------------------------------------------------------
// Sankey
// ---------------------------------------------------------------------------

export interface SankeyLink { source: string; target: string; value: number; }

export function genSankey(
  sourceNames: string[],
  targetNames: string[],
  mode: DataMode = "synthetic"
): SankeyLink[] {
  if (mode === "synthetic") {
    const r = rng(0x5a4b);
    return sourceNames.flatMap((s, i) =>
      targetNames.map((t): SankeyLink => ({
        source: s,
        target: t,
        value: 10 + Math.round(r() * 30) + i * 2,
      }))
    );
  }
  // Messy: one source dominates; a few links near-zero (will be invisible
  // thin flows — critical test for whether colors remain legible at hairline width).
  const r = rng(0xb00b);
  return sourceNames.flatMap((s, i) =>
    targetNames.map((t, j): SankeyLink => {
      if (i === 0) return { source: s, target: t, value: 60 + Math.round(r() * 30) }; // dominant
      if (j === targetNames.length - 1 && i > 0) return { source: s, target: t, value: 1 + Math.round(r() * 2) }; // hairline
      return { source: s, target: t, value: 5 + Math.round(r() * 15) };
    })
  );
}

// ---------------------------------------------------------------------------
// Candlestick
// ---------------------------------------------------------------------------

export interface OHLCBar { open: number; close: number; low: number; high: number; }

export function genCandlestick(mode: DataMode = "synthetic"): OHLCBar[] {
  const bars = 30;
  if (mode === "synthetic") {
    // Smooth sine-wave trend — easy to read, no surprises.
    const r = rng(0x0123);
    const bars30: OHLCBar[] = [];
    let price = 100;
    for (let i = 0; i < bars; i++) {
      const trend = 8 * Math.sin(i / 5);
      const open = price;
      const close = Math.round(open + trend + (r() - 0.5) * 6);
      const high = Math.max(open, close) + Math.round(r() * 4);
      const low = Math.min(open, close) - Math.round(r() * 4);
      bars30.push({ open, close, high, low });
      price = close;
    }
    return bars30;
  }
  // Messy: sudden crash at bar 10, large wicks, long flat stretches then spikes.
  const r = rng(0xdead);
  const bars30: OHLCBar[] = [];
  let price = 100;
  for (let i = 0; i < bars; i++) {
    const crash = i === 10; // sudden -30 drop
    const spike = i === 22; // sudden +25 spike
    const flat = i >= 14 && i <= 18; // price barely moves
    const open = price;
    const closeBase = crash ? open - 30 : spike ? open + 25 : flat ? open + (r() - 0.5) * 2 : open + (r() - 0.5) * 12;
    const close = Math.round(closeBase);
    const wickMult = crash || spike ? 3 : 1;
    const high = Math.max(open, close) + Math.round(r() * 6 * wickMult);
    const low = Math.min(open, close) - Math.round(r() * 6 * wickMult);
    bars30.push({ open, close, high, low });
    price = close;
  }
  return bars30;
}

// ---------------------------------------------------------------------------
// Choropleth proxy (grid heatmap — no GeoJSON)
// ---------------------------------------------------------------------------

export function genChoropleth(mode: DataMode = "synthetic"): Array<[number, number, number]> {
  if (mode === "synthetic") {
    // Smooth gradient left-to-right.
    const r = rng(0x8812);
    return Array.from({ length: 36 }, (_, i) => {
      const x = i % 6;
      const y = Math.floor(i / 6);
      return [x, y, Math.round(10 + x * 14 + r() * 10)] as [number, number, number];
    });
  }
  // Messy: two hot spots, remainder near-zero — stresses the sequential ramp.
  const r = rng(0x1337);
  return Array.from({ length: 36 }, (_, i) => {
    const x = i % 6;
    const y = Math.floor(i / 6);
    const hot1 = Math.exp(-((x - 1) ** 2 + (y - 1) ** 2) / 1.5) * 95;
    const hot2 = Math.exp(-((x - 4) ** 2 + (y - 4) ** 2) / 2) * 80;
    return [x, y, Math.round(Math.min(100, hot1 + hot2 + r() * 5))] as [number, number, number];
  });
}

// ---------------------------------------------------------------------------
// Pie / donut / rose / funnel shared values
// ---------------------------------------------------------------------------

export interface PieItem { name: string; value: number; }

export function genPie(n: number, mode: DataMode = "synthetic"): PieItem[] {
  const names = SERIES_NAMES.slice(0, n);
  if (mode === "synthetic") {
    // Even-ish slices with modest variation — no slice dominates.
    const r = rng(0xf14e);
    return names.map((name, i) => ({
      name,
      value: 20 + Math.round(40 * Math.abs(Math.sin(i * 1.7))) + Math.round(r() * 10),
    }));
  }
  // Messy: one slice is ~65% of the total; two near-equal tiny slices that
  // will look identical in grayscale; the rest distributed normally.
  const r = rng(0x5a2b);
  return names.map((name, i) => {
    if (i === 0) return { name, value: 130 + Math.round(r() * 20) }; // dominant
    if (i === 1 || i === 2) return { name, value: 8 + Math.round(r() * 3) }; // near-equal tiny
    return { name, value: 15 + Math.round(r() * 25) };
  });
}


