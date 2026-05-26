/**
 * Per-entity slot pinning.
 *
 * Builds a permutation of slot indices from a user pin map (entityId → slotIndex)
 * and the ordered list of active entities. Guarantees:
 *
 *   - Result is a true permutation (no slot used twice) — when two entities
 *     pin to the same slot, later assignments push the earlier one to the
 *     next free slot, preserving overall identity.
 *   - Entities without pins keep their natural order, filling remaining slots.
 *   - Stable: re-running with the same inputs yields the same output.
 *
 * Pairs with `setEntityColor` / `getEntityColor` in `overrides.ts` for
 * persistence across reloads.
 */
import { getEntityColor } from "./overrides";

export interface PinResult {
  /** slot index for each entity, in entity order. */
  slots: number[];
  /** entities that requested a slot already taken (moved to next free slot). */
  collisions: string[];
}

export function buildPinPermutation(entities: string[], n: number): PinResult {
  const slots: number[] = new Array(entities.length).fill(-1);
  const used = new Set<number>();
  const collisions: string[] = [];

  // 1. Honor explicit pins in entity order; first wins on collision.
  entities.forEach((id, i) => {
    const requested = getEntityColor(id);
    if (requested != null && requested >= 0 && requested < n && !used.has(requested)) {
      slots[i] = requested;
      used.add(requested);
    } else if (requested != null && used.has(requested)) {
      collisions.push(id);
    }
  });

  // 2. Fill remaining entities with the lowest free slot, in entity order.
  let cursor = 0;
  for (let i = 0; i < entities.length; i++) {
    if (slots[i] !== -1) continue;
    while (used.has(cursor) && cursor < n) cursor++;
    if (cursor >= n) break; // shouldn't happen when entities.length ≤ n
    slots[i] = cursor;
    used.add(cursor);
    cursor++;
  }

  return { slots, collisions };
}

/** Apply a pin permutation to the four paired scales of a chartTheme. */
export function applyPinsToTheme<T extends {
  colorHexes: string[];
  dashes: ReadonlyArray<unknown>;
  decals: ReadonlyArray<unknown>;
  shapes: string[];
}>(theme: T, slots: number[]): T {
  return {
    ...theme,
    colorHexes: slots.map((s) => theme.colorHexes[s]),
    dashes: slots.map((s) => theme.dashes[s]) as T["dashes"],
    decals: slots.map((s) => theme.decals[s]) as T["decals"],
    shapes: slots.map((s) => theme.shapes[s]),
  };
}
