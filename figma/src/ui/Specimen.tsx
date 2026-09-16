import { dashScale, shapeScale } from "@engine/encoding";

const MARKER: Record<string, (cx: number, cy: number, c: string) => JSX.Element> = {
  circle: (x, y, c) => <circle cx={x} cy={y} r="3.2" fill={c} />,
  triangle: (x, y, c) => <polygon points={`${x},${y - 3.4} ${x + 3.4},${y + 2.6} ${x - 3.4},${y + 2.6}`} fill={c} />,
  rect: (x, y, c) => <rect x={x - 3} y={y - 3} width="6" height="6" fill={c} />,
  diamond: (x, y, c) => <polygon points={`${x},${y - 3.8} ${x + 3.4},${y} ${x},${y + 3.8} ${x - 3.4},${y}`} fill={c} />,
  pin: (x, y, c) => <path d={`M${x} ${y - 3.8}c1.9 0 3.2 1.4 3.2 3.1 0 2-3.2 4.6-3.2 4.6s-3.2-2.6-3.2-4.6c0-1.7 1.3-3.1 3.2-3.1Z`} fill={c} />,
  arrow: (x, y, c) => <polygon points={`${x},${y - 3.8} ${x + 3.4},${y + 3.4} ${x},${y + 1.6} ${x - 3.4},${y + 3.4}`} fill={c} />,
  roundRect: (x, y, c) => <rect x={x - 3} y={y - 3} width="6" height="6" rx="1.8" fill={c} />,
};

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
  const name = shapeScale[slot % shapeScale.length];
  const draw = MARKER[name] ?? MARKER.circle;
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
      {draw(width / 2, y, color)}
    </svg>
  );
}
