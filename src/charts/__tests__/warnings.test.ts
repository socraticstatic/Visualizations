/**
 * Regression tests for buildWarningList.
 *
 * Commit 662346a split one `capped` flag into `collapsed` (the posture cap
 * actually engaged Top-N + Other) and `aboveSafe` (N merely exceeds the
 * solver-safe cap). It updated `if (capped)` but missed a `!capped` in the
 * "above recommended" branch, leaving an undefined identifier there.
 *
 * That branch is unreachable today because the slider clamps N to
 * `recommendedN`, so `rendered > recommendedN` short-circuits before the bad
 * identifier is evaluated. These tests call the builder directly, which is
 * the only way to reach it, and pin the intended behaviour so the landmine
 * cannot come back if the clamp ever loosens.
 */
import { describe, it, expect } from "vitest";
import { buildWarningList } from "@/charts/warnings";
import { BEST_PRACTICE } from "@/charts/bestPractices";
import type { AuditReport } from "@/charts/audit";

const cleanAudit: AuditReport = {
  perVision: [
    { mode: "normal", minDeltaE: 9, pass: true, threshold: 1 },
    { mode: "deutan", minDeltaE: 8, pass: true, threshold: 1 },
  ],
  worstContrastVsBg: 5.2,
  bgPass: true,
  overall: "pass",
};

const bar = BEST_PRACTICE.bar; // recommendedN 12, maxN 12, no warn()
const pie = BEST_PRACTICE.pie; // recommendedN 4, maxN 5, has warn()

const titles = (ws: ReturnType<typeof buildWarningList>) => ws.map((w) => w.title);

describe("the above-recommended branch", () => {
  it("fires when N is above recommendedN and nothing was collapsed", () => {
    const ws = buildWarningList("bar", bar, 14, 14, false, false, 12, cleanAudit, []);
    expect(titles(ws)).toContain(
      `N=14 is above the recommended ${bar.recommendedN} for Bar`
    );
  });

  it("stays quiet when slots were collapsed, because the hard-cap error already says it", () => {
    const ws = buildWarningList("bar", bar, 14, 14, true, false, 12, cleanAudit, []);
    expect(titles(ws).some((t) => t.startsWith("N=14 is above the recommended"))).toBe(false);
    expect(titles(ws)[0]).toContain("exceeds the Bar hard cap");
  });

  it("does not fire at or below recommendedN", () => {
    const ws = buildWarningList("bar", bar, 12, 12, false, false, 12, cleanAudit, []);
    expect(titles(ws).some((t) => t.includes("above the recommended"))).toBe(false);
  });

  it("yields to the kind's own warn() copy when that fires", () => {
    // pie.warn(6) returns its own message, so the generic branch must not add a second one.
    const ws = buildWarningList("pie", pie, 6, 6, false, false, 4, cleanAudit, []);
    expect(titles(ws).some((t) => t.includes("above the recommended"))).toBe(false);
    expect(titles(ws).some((t) => t.includes("misrepresent magnitudes"))).toBe(true);
  });
});

describe("collapsed and aboveSafe stay distinct", () => {
  it("reports the hard cap only when slots actually collapsed", () => {
    const ws = buildWarningList("bar", bar, 20, 12, true, false, 12, cleanAudit, []);
    expect(ws[0].severity).toBe("error");
    expect(ws[0].detail).toContain('collapsed into "Other"');
  });

  it("reports the solver-safe cap only when nothing collapsed", () => {
    const above = buildWarningList("bar", bar, 10, 10, false, true, 7, cleanAudit, []);
    expect(titles(above)).toContain("N=10 is above the solver-safe cap of 7 for this theme");

    const both = buildWarningList("bar", bar, 10, 10, true, true, 7, cleanAudit, []);
    expect(titles(both).some((t) => t.includes("solver-safe cap"))).toBe(false);
  });
});

describe("audit findings", () => {
  it("makes a normal-vision failure an error and a CVD failure a warning", () => {
    const failing: AuditReport = {
      ...cleanAudit,
      perVision: [
        { mode: "normal", minDeltaE: 0.4, pass: false, threshold: 1 },
        { mode: "deutan", minDeltaE: 0.6, pass: false, threshold: 1 },
      ],
      overall: "fail",
    };
    const ws = buildWarningList("bar", bar, 6, 6, false, false, 12, failing, []);
    const normal = ws.find((w) => w.title.startsWith("normal"))!;
    const deutan = ws.find((w) => w.title.startsWith("deutan"))!;
    expect(normal.severity).toBe("error");
    expect(deutan.severity).toBe("warn");
  });

  it("reports a background-contrast failure as an error", () => {
    const ws = buildWarningList(
      "bar", bar, 6, 6, false, false, 12,
      { ...cleanAudit, bgPass: false, worstContrastVsBg: 2.1, overall: "fail" },
      []
    );
    expect(ws.some((w) => w.severity === "error" && w.title.includes("2.10:1"))).toBe(true);
  });

  it("lists each solver relaxation as info", () => {
    const ws = buildWarningList("bar", bar, 6, 6, false, false, 12, cleanAudit, ["minDeltaENormal", "minDeltaECvd"]);
    const infos = ws.filter((w) => w.severity === "info");
    expect(infos.map((w) => w.title)).toEqual([
      "Solver relaxed: minDeltaENormal",
      "Solver relaxed: minDeltaECvd",
    ]);
  });

  it("returns an empty list when nothing is wrong", () => {
    expect(buildWarningList("bar", bar, 6, 6, false, false, 12, cleanAudit, [])).toEqual([]);
  });
});
