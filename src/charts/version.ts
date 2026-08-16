/**
 * PALETTE_VERSION is the single displayed/published version: the app footer,
 * export headers, and the npm package (scripts/build-lib.mjs reads this
 * literal) all derive from it.
 *
 * It MUST equal the root package.json "version". A direct package.json import
 * would break the library build (tsconfig.lib.json rootDir is src/charts), so
 * the sync is enforced instead by src/charts/__tests__/version.test.ts and by
 * a hard check in scripts/build-lib.mjs — bump both together.
 */
export const PALETTE_VERSION = "0.7.2";
