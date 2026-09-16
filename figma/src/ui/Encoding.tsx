import { decalScale, shapeScale, dashScale } from "@engine/encoding";

/** The dash a slot carries, drawn at the size a designer would actually see. */
export function DashPreview({ slot, color }: { slot: number; color: string }) {
  const d = dashScale[slot % dashScale.length];
  return (
    <svg width="44" height="10" viewBox="0 0 44 10" aria-hidden focusable="false">
      <line
        x1="1" y1="5" x2="43" y2="5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={d === "solid" ? undefined : d.join(" ")}
      />
    </svg>
  );
}

const MARKER: Record<string, (c: string) => JSX.Element> = {
  circle: (c) => <circle cx="6" cy="6" r="4.4" fill={c} />,
  triangle: (c) => <polygon points="6,1.4 11,10 1,10" fill={c} />,
  rect: (c) => <rect x="1.8" y="1.8" width="8.4" height="8.4" fill={c} />,
  diamond: (c) => <polygon points="6,1 11,6 6,11 1,6" fill={c} />,
  pin: (c) => <path d="M6 1c2.5 0 4.2 1.9 4.2 4.1C10.2 7.8 6 11.4 6 11.4S1.8 7.8 1.8 5.1C1.8 2.9 3.5 1 6 1Z" fill={c} />,
  arrow: (c) => <polygon points="6,1 11,10.6 6,8.4 1,10.6" fill={c} />,
  roundRect: (c) => <rect x="1.8" y="1.8" width="8.4" height="8.4" rx="2.6" fill={c} />,
};

export function ShapeMarker({ slot, color }: { slot: number; color: string }) {
  const name = shapeScale[slot % shapeScale.length];
  const draw = MARKER[name] ?? MARKER.circle;
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      {draw(color)}
    </svg>
  );
}

/**
 * The decal a slot carries. Rendered here as real SVG because the panel is a
 * browser; it cannot cross into a Figma mockup, where pattern fills are dropped.
 */
export function DecalSwatch({ slot, color }: { slot: number; color: string }) {
  const d = decalScale[slot % decalScale.length];
  const id = `decal-${slot}`;
  const deg = Math.round((d.rotation * 180) / Math.PI);
  const tile = d.symbol === "none" ? null : (
    <pattern
      id={id}
      width={d.symbol === "rect" ? 6 : 8}
      height={d.symbol === "rect" ? 6 : 8}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${deg})`}
    >
      {d.symbol === "rect" && <rect width="6" height="2.4" fill={color} />}
      {d.symbol === "circle" && <circle cx="4" cy="4" r={1.6 * d.symbolSize} fill={color} />}
      {d.symbol === "triangle" && <polygon points="4,1.4 6.6,6.4 1.4,6.4" fill={color} />}
      {d.symbol === "diamond" && <polygon points="4,1.2 6.8,4 4,6.8 1.2,4" fill={color} />}
    </pattern>
  );

  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden focusable="false">
      {tile && <defs>{tile}</defs>}
      <rect
        x="0.5" y="0.5" width="21" height="11" rx="2"
        fill={tile ? `url(#${id})` : "transparent"}
        stroke={color}
        strokeOpacity="0.45"
      />
    </svg>
  );
}
