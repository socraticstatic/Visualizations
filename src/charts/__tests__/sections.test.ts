import { describe, it, expect } from "vitest";
import { SECTION_IDS } from "@/charts/urlState";
import { SECTION_LABELS } from "@/components/charts/SectionNav";

describe("section constants", () => {
  it("labels every section id", () => {
    for (const id of SECTION_IDS) {
      expect(SECTION_LABELS[id], id).toBeTruthy();
    }
  });

  it("has no labels for ids that do not exist", () => {
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...SECTION_IDS].sort());
  });

  it("uses no em dashes in labels", () => {
    for (const label of Object.values(SECTION_LABELS)) {
      expect(label).not.toContain("—");
    }
  });

  it("has four sections, not the old seven", () => {
    // The old FlowStepper showed seven pills that all pointed into a single
    // <section id="flow-build">, and could not reach two screens of audit
    // content that sat outside its map entirely.
    expect(SECTION_IDS).toHaveLength(4);
  });
});
