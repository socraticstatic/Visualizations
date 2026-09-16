/**
 * The manifest has to be publishable.
 *
 * It carried a development placeholder id for the whole build. A placeholder
 * is invisible until the moment you try to publish, and nothing in the suite
 * would have said a word.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAID_FEATURES } from "./license";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "manifest.json"), "utf8")
) as Record<string, unknown>;

describe("manifest", () => {
  it("carries the id Figma issued, not a placeholder", () => {
    const id = String(manifest.id ?? "");
    expect(id).toMatch(/^\d{19}$/);
    // The stand-in used during development. Figma-issued ids are not round.
    expect(id).not.toBe("1000000000000000001");
    expect(id).not.toMatch(/^10{15}/);
  });

  it("declares no network access, which is a claim the listing makes", () => {
    expect(manifest.networkAccess).toEqual({ allowedDomains: ["none"] });
  });

  it("offers a menu command for every command the plugin implements", () => {
    const menu = manifest.menu as Array<{ command: string }>;
    const commands = menu.map((m) => m.command);
    expect(commands).toEqual(["generate", "audit", "simulate", "mockup"]);
    // Three of the four are paid; audit and simulate stay free.
    expect(PAID_FEATURES).toContain("mockup");
  });

  it("uses dynamic-page access, which the variable getters require", () => {
    expect(manifest.documentAccess).toBe("dynamic-page");
  });
});
