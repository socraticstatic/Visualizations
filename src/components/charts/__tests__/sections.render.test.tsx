import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Evidence } from "../sections/Evidence";
import { Storytell } from "../sections/Storytell";
import { Reuse } from "../sections/Reuse";
import { Ship } from "../sections/Ship";
import { SECTION_IDS } from "@/charts/urlState";
import { SECTION_LABELS, sectionElementId } from "../SectionNav";

const WRAPPERS = [
  ["evidence", Evidence],
  ["storytell", Storytell],
  ["reuse", Reuse],
  ["ship", Ship],
] as const;

describe("section wrappers", () => {
  it("covers every declared section id", () => {
    expect(WRAPPERS.map(([id]) => id).sort()).toEqual([...SECTION_IDS].sort());
  });

  for (const [id, Comp] of WRAPPERS) {
    it(`${id}: anchors at the id the nav scrolls to`, () => {
      const { container } = render(<Comp>{null}</Comp>);
      // A mismatch here means the nav pill silently scrolls nowhere.
      expect(container.querySelector(`#${sectionElementId(id)}`)).toBeInTheDocument();
    });

    it(`${id}: has a real h2`, () => {
      // flow-verify and flow-reuse previously rendered with no heading at all,
      // so jumping to them landed the reader in unlabeled space.
      render(<Comp>{null}</Comp>);
      expect(
        screen.getByRole("heading", { level: 2, name: SECTION_LABELS[id] })
      ).toBeInTheDocument();
    });
  }
});
