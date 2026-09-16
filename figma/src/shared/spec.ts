/**
 * What to write into the file.
 *
 * Colour variables are bindable. The dash, decal and shape variables are
 * reference values a designer reads and retypes: VariableBindableNodeField has
 * 27 members and no dash field. Decal additionally never renders in Figma at
 * all, because Figma discards pattern fills on SVG import.
 */
import type { ColorRecord } from "@engine/palette/distance";
import { dashScale, decalScale, shapeScale, MAX_SLOTS } from "@engine/encoding";
import { toFigmaRgb, type FigmaRgb } from "./color";

export type VariableKind = "COLOR" | "STRING";

export interface VariableSpec {
  name: string;
  kind: VariableKind;
  light: FigmaRgb | string;
  dark: FigmaRgb | string;
  /** Dev Mode / CSS / iOS / Android handoff name. */
  codeSyntax: string;
  /** Where Figma offers this variable. Colours are fills and strokes only. */
  scopes: string[];
}

export interface ThemeInput {
  palette: ColorRecord[];
  surface: ColorRecord;
  grid: ColorRecord;
  axis: ColorRecord;
  label: ColorRecord;
}

/** A dash the designer can retype into Figma's stroke panel. */
export function formatDash(d: "solid" | number[]): string {
  return d === "solid" ? "solid" : d.join(" ");
}

/** A readable decal label. Never rendered in Figma; see the spec's C3. */
export function describeDecal(d: (typeof decalScale)[number]): string {
  if (d.symbol === "none") return "none";
  if (d.symbol !== "rect") return `${d.symbol}s`;
  const deg = Math.round((d.rotation * 180) / Math.PI);
  if (deg === 0) return "horizontal lines";
  if (deg === 90 || deg === -90) return "vertical lines";
  return `diagonal lines ${deg} deg`;
}

const COLOR_SCOPES = ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"];
const TEXT_SCOPES = ["TEXT_CONTENT"];

const color = (name: string, code: string, light: ColorRecord, dark: ColorRecord): VariableSpec => ({
  name,
  kind: "COLOR",
  light: toFigmaRgb(light),
  dark: toFigmaRgb(dark),
  codeSyntax: code,
  scopes: COLOR_SCOPES,
});

const text = (name: string, code: string, value: string): VariableSpec => ({
  name,
  kind: "STRING",
  light: value,
  dark: value,
  codeSyntax: code,
  scopes: TEXT_SCOPES,
});

export function buildVariableSpec(input: { light: ThemeInput; dark: ThemeInput }): VariableSpec[] {
  const { light, dark } = input;
  if (light.palette.length !== dark.palette.length) {
    throw new Error(
      `Light and dark disagree on slot count: ${light.palette.length} vs ${dark.palette.length}.`
    );
  }
  const n = Math.min(light.palette.length, MAX_SLOTS);
  const specs: VariableSpec[] = [];

  for (let i = 0; i < n; i++) {
    const slot = i + 1;
    specs.push(color(`chart/series/${slot}/color`, `chart.series${slot}.color`, light.palette[i], dark.palette[i]));
    specs.push(text(`chart/series/${slot}/dash`, `chart.series${slot}.dash`, formatDash(dashScale[i])));
    specs.push(text(`chart/series/${slot}/decal`, `chart.series${slot}.decal`, describeDecal(decalScale[i])));
    specs.push(text(`chart/series/${slot}/shape`, `chart.series${slot}.shape`, shapeScale[i]));
  }

  specs.push(color("chart/surface", "chart.surface", light.surface, dark.surface));
  specs.push(color("chart/grid", "chart.grid", light.grid, dark.grid));
  specs.push(color("chart/axis", "chart.axis", light.axis, dark.axis));
  specs.push(color("chart/label", "chart.label", light.label, dark.label));

  return specs;
}

export type WrittenRecord = Record<string, { light: string; dark: string }>;

export interface Drift {
  name: string;
  mode: "light" | "dark";
  recorded: string;
  current: string;
}

const asRecordValue = (v: FigmaRgb | string): string =>
  typeof v === "string" ? v : `${v.r.toFixed(6)},${v.g.toFixed(6)},${v.b.toFixed(6)}`;

export function recordFromSpecs(specs: VariableSpec[]): WrittenRecord {
  const out: WrittenRecord = {};
  for (const s of specs) out[s.name] = { light: asRecordValue(s.light), dark: asRecordValue(s.dark) };
  return out;
}

/**
 * Variables whose current value differs from what the plugin last wrote. Only
 * names the plugin wrote are considered: a designer's own variables are none of
 * its business, and one that has since been deleted is not drift. JTBD-8 is a
 * per-user colour pin, so these are presented for confirmation, never
 * overwritten silently.
 */
export function diffWritten(recorded: WrittenRecord, current: WrittenRecord): Drift[] {
  const out: Drift[] = [];
  for (const [name, was] of Object.entries(recorded)) {
    const now = current[name];
    if (!now) continue;
    for (const mode of ["light", "dark"] as const) {
      if (now[mode] !== was[mode]) out.push({ name, mode, recorded: was[mode], current: now[mode] });
    }
  }
  return out;
}
