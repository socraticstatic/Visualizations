import { useEffect, useState } from "react";
import { fromCss, type ColorRecord } from "@engine/palette/distance";
import { contrastRatio } from "@engine/audit";
import { resolveBackground, BACKGROUND_REFUSAL_COPY } from "../shared/background";
import { onSelectionChange, send } from "./bridge";

export type BackgroundSource = "canvas" | "explicit" | "default";

export interface BackgroundChoice {
  color: ColorRecord;
  source: BackgroundSource;
  /** Set when the canvas was asked and could not answer. */
  refusal: string | null;
  /** The layer the colour came from, when it came from the canvas. */
  fromNodeId?: string;
}

const HEX = /^#?[0-9a-fA-F]{6}$/;

/**
 * The background is an input, not an assumption.
 *
 * A palette solved against white and then used on #1b1f24 is the exact failure
 * this system exists to catch, so the surface the chart actually sits on is
 * read from the canvas where possible and typed in where not. The default is
 * offered, clearly labelled as a default, and never silently.
 */
export function BackgroundControl({
  fallback,
  value,
  onChange,
}: {
  fallback: ColorRecord;
  value: BackgroundChoice;
  onChange: (c: BackgroundChoice) => void;
}) {
  const [hex, setHex] = useState(value.color.hex);
  const [watching, setWatching] = useState(true);

  useEffect(() => setHex(value.color.hex), [value.color.hex]);

  /** Ask the canvas what is behind the selection. */
  async function fromCanvas() {
    const res = await send({ type: "read-selection" });
    if (!res.ok || res.type !== "selection") {
      onChange({ color: fallback, source: "default", refusal: "Nothing is selected, so there is no backdrop to read." });
      return;
    }
    const r = resolveBackground(res.payload.backdrop);
    if (!r.ok) {
      onChange({ color: value.color, source: value.source, refusal: BACKGROUND_REFUSAL_COPY[r.reason] });
      return;
    }
    onChange({ color: r.color, source: "canvas", refusal: null, fromNodeId: r.fromNodeId });
  }

  useEffect(() => {
    if (!watching) return;
    return onSelectionChange((payload) => {
      const r = resolveBackground(payload.backdrop);
      if (r.ok) onChange({ color: r.color, source: "canvas", refusal: null, fromNodeId: r.fromNodeId });
      else onChange({ color: value.color, source: value.source, refusal: BACKGROUND_REFUSAL_COPY[r.reason] });
    });
  }, [watching, onChange, value.color, value.source]);

  const label =
    value.source === "canvas"
      ? "read from the layers behind your selection"
      : value.source === "explicit"
        ? "typed in"
        : "this plugin's default, not your file";

  return (
    <div className="field">
      <span className="field__label">Background</span>
      <div className="bg">
        <span className="bg__chip" style={{ background: value.color.hex }} />
        <input
          className="bg__hex num"
          value={hex}
          spellCheck={false}
          aria-label="Background colour"
          onChange={(e) => {
            const next = e.target.value;
            setHex(next);
            if (HEX.test(next)) {
              setWatching(false);
              onChange({ color: fromCss(next.startsWith("#") ? next : `#${next}`), source: "explicit", refusal: null });
            }
          }}
        />
        <button
          className="bg__btn"
          onClick={() => {
            setWatching(true);
            void fromCanvas();
          }}
        >
          Use canvas
        </button>
      </div>
      <p className="bg__note">
        {label}
        {value.source !== "default" && (
          <>
            {" · "}
            <span className="num">{contrastRatio(fromCss("#ffffff"), value.color).toFixed(2)}</span> against white
          </>
        )}
      </p>
      {value.refusal && <p className="bg__refusal">{value.refusal} Type one in to solve against it anyway.</p>}
    </div>
  );
}
