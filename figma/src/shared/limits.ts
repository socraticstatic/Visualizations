/**
 * Every cap in one place, each with the reason it exists. Three surfaces used
 * to carry three unrelated numbers, which meant the same selection was
 * truncated at 400, refused at 200, and processed without limit depending on
 * which tab you were standing in.
 */

/** The encoding scales run out past this, so a slot has no dash or shape left. */
export { MAX_SLOTS } from "@engine/encoding";

/**
 * Nodes read from a selection for auditing. Past this the panel reports how
 * much it is not seeing rather than presenting a prefix as a verdict.
 */
export const MAX_READ_NODES = 400;

/**
 * Filled nodes codegen will read as a set of series. A chart pasted as vectors
 * has one path per point, and emitting hundreds of fabricated series is worse
 * than refusing.
 */
export const MAX_CODEGEN_NODES = 200;

/**
 * Nodes a single simulation pass will clone. One copy per vision type means
 * this many multiplied by four land on the canvas, so a pasted chart would
 * create tens of thousands of nodes synchronously.
 */
export const MAX_SIMULATION_NODES = 250;

export const SIMULATION_COPIES = 4;

/** Nodes a single inserted mockup may create. See shared/mockup.ts. */
export { MAX_MOCKUP_NODES } from "./mockup";
