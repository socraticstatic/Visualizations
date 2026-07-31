import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PaletteVerdict } from "../PaletteVerdict";
import { auditPalette } from "@/charts/audit";
import { fromCss } from "@/charts/palette/distance";

/**
 * PaletteVerdict replaces BuilderAuditStatus + AuditSummaryCard + the inline
 * AccessibilityHarness. Between them those three printed the same contrast
 * ratio and the same min ΔE in three places across five screens of scroll.
 * The load-bearing assertion here is that the verdict is stated ONCE.
 */
function fixture(hexes: string[] = ["#1f77b4", "#d62728", "#2ca02c", "#9467bd"]) {
  const palette = hexes.map((h) => fromCss(h));
  const background = fromCss("#ffffff");
  return { audit: auditPalette(palette, background), relaxations: [] as string[] };
}

describe("PaletteVerdict", () => {
  it("states the min ΔE exactly once", () => {
    render(<PaletteVerdict {...fixture()} />);
    expect(screen.getAllByTestId("verdict-min-delta-e")).toHaveLength(1);
  });

  it("shows contrast, min ΔE, and relaxation count when collapsed", () => {
    render(<PaletteVerdict {...fixture()} />);
    expect(screen.getByTestId("verdict-contrast")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-min-delta-e")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-relaxations")).toBeInTheDocument();
  });

  it("reports 'none' when no constraints were relaxed", () => {
    render(<PaletteVerdict {...fixture()} />);
    expect(screen.getByTestId("verdict-relaxations")).toHaveTextContent(/none/i);
  });

  it("names the relaxed constraints when there are some", () => {
    render(<PaletteVerdict {...fixture()} relaxations={["minDeltaECvd"]} />);
    expect(screen.getByTestId("verdict-relaxations")).toHaveTextContent(/minDeltaECvd/);
  });

  it("hides the per-mode breakdown until expanded", () => {
    render(<PaletteVerdict {...fixture()} />);
    expect(screen.queryByTestId("verdict-modes")).not.toBeInTheDocument();
  });

  it("lists all five vision modes when expanded", () => {
    render(<PaletteVerdict {...fixture()} />);
    fireEvent.click(screen.getByRole("button", { name: /detail/i }));
    const modes = screen.getByTestId("verdict-modes");
    for (const label of [/normal/i, /deutan/i, /protan/i, /tritan/i, /grayscale/i]) {
      expect(modes).toHaveTextContent(label);
    }
  });

  it("prints n/a rather than Infinity for ramps", () => {
    // Sequential and diverging ramps skip pairwise ΔE by design, so every
    // perVision entry comes back Infinity. .toFixed() on that renders the
    // string "Infinity", which is not a thing a designer can act on.
    const palette = ["#e0f3f8", "#abd9e9", "#74add1"].map((h) => fromCss(h));
    const audit = auditPalette(palette, fromCss("#ffffff"), true);
    render(<PaletteVerdict audit={audit} relaxations={[]} />);
    expect(screen.getByTestId("verdict-min-delta-e")).not.toHaveTextContent(/Infinity/);
  });

  it("labels each config in compare mode", () => {
    render(<PaletteVerdict {...fixture()} label="A" dense />);
    expect(screen.getByLabelText(/palette verdict a/i)).toBeInTheDocument();
  });

  it("omits the expand control when dense", () => {
    // Compare mode renders two verdicts in a slim sticky bar; there is no
    // room for expansion there.
    render(<PaletteVerdict {...fixture()} label="A" dense />);
    expect(screen.queryByRole("button", { name: /detail/i })).not.toBeInTheDocument();
  });
});
