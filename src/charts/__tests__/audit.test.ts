import { describe, it, expect } from "vitest";
import { auditPalette, VISION_MODES } from "@/charts/audit";
import { fromCss } from "@/charts/palette/distance";

const white = fromCss("#ffffff");

describe("auditPalette", () => {
  it("reports fail (not vacuous pass) for an empty palette", () => {
    const report = auditPalette([], white);
    expect(report.overall).toBe("fail");
  });

  it("passes a clearly separated two-color palette on white", () => {
    const report = auditPalette([fromCss("#1d4ed8"), fromCss("#b91c1c")], white);
    expect(report.overall).toBe("pass");
  });

  it("audits exactly the runtime vision-mode list", () => {
    const report = auditPalette([fromCss("#1d4ed8")], white);
    expect(report.perVision.map((v) => v.mode)).toEqual([...VISION_MODES]);
  });
});
