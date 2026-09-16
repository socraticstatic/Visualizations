import { dashScale, markerPathD } from "@engine/encoding";

/**
 * One series as it actually renders: a stroke carrying its dash, a marker
 * carrying its shape, drawn in whatever the eye receives after simulation, on
 * the surface the palette was solved against.
 *
 * This is the argument. Under achromatopsia the colours collapse and the dash
 * and marker are the only thing left holding the series apart.
 */
export function Specimen({
  slot,
  color,
  surface,
  width = 52,
  height = 22,
}: {
  slot: number;
  color: string;
  surface: string;
  width?: number;
  height?: number;
}) {
  const d = dashScale[slot % dashScale.length];
  const y = height / 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden focusable="false">
      <rect width={width} height={height} fill={surface} />
      <line
        x1="3"
        y1={y}
        x2={width - 3}
        y2={y}
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray={d === "solid" ? undefined : d.join(" ")}
      />
      <path d={markerPathD(slot, width / 2, y, 3.2)} fill={color} />
    </svg>
  );
}
