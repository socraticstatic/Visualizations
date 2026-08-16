/**
 * Hex ↔ `H S% L%` triple conversion for the chart CSS tokens.
 *
 * The triples feed `hsl(var(--token))`, so they must be strings — but they
 * carry the user's color, so the round-trip hex → triple → hex must be
 * identity. Rounding H/S/L to integers (the old behavior) quantized the
 * triple far coarser than the 1/255 RGB step and shifted user hexes
 * (#777777 became #787878). Four decimals keeps the worst-case RGB error
 * around 1e-6 per channel — three orders of magnitude below the 1/510
 * half-step where formatHex would round to a different byte — so every one
 * of the 16.7M hex values survives exactly.
 */
import { converter, parse, formatHex } from "culori";

const toHsl = converter("hsl");

/** 4-decimal fixed precision, trailing zeros trimmed ("46.6667", "0"). */
function fmt(n: number): string {
  return String(Number(n.toFixed(4)));
}

export function hslTripleToHex(triple: string): string {
  const parsed = parse(`hsl(${triple})`);
  return parsed ? (formatHex(parsed) ?? "#000000") : "#000000";
}

export function hexToHslTriple(hex: string): string {
  const c = toHsl(parse(hex)!);
  if (!c) return "0 0% 0%";
  return `${fmt(c.h ?? 0)} ${fmt((c.s ?? 0) * 100)}% ${fmt((c.l ?? 0) * 100)}%`;
}
