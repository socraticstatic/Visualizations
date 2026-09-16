import { describe, it, expect } from "vitest";
import { MAX_READ_NODES, MAX_CODEGEN_NODES, MAX_SIMULATION_NODES, SIMULATION_COPIES, MAX_SLOTS } from "./limits";

describe("limits", () => {
  it("are all positive integers", () => {
    for (const v of [MAX_READ_NODES, MAX_CODEGEN_NODES, MAX_SIMULATION_NODES, SIMULATION_COPIES, MAX_SLOTS]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("keeps the read cap at or above what any single surface will process", () => {
    expect(MAX_READ_NODES).toBeGreaterThanOrEqual(MAX_CODEGEN_NODES);
    expect(MAX_READ_NODES).toBeGreaterThanOrEqual(MAX_SIMULATION_NODES);
  });

  it("keeps a simulation under a node count Figma can place at once", () => {
    expect(MAX_SIMULATION_NODES * SIMULATION_COPIES).toBeLessThanOrEqual(2000);
  });
});
