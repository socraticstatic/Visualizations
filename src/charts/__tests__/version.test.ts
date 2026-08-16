import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PALETTE_VERSION } from "@/charts/version";

/**
 * The UI footer, export headers, and the published npm package all display
 * PALETTE_VERSION, while npm tooling reads package.json. They drifted once
 * (package.json sat at 0.1.0 while the UI showed v0.7.0) — pin them together.
 * A direct package.json import in version.ts would break the library build
 * (tsconfig.lib rootDir), so the sync is enforced here and in build-lib.mjs.
 */
describe("version sync", () => {
  it("package.json version matches PALETTE_VERSION", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../../../package.json"), "utf8")
    ) as { version: string };
    expect(pkg.version).toBe(PALETTE_VERSION);
  });
});
