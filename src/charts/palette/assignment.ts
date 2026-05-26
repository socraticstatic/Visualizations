/**
 * Stable slot assignment when N changes.
 *
 * Given a previous (entityId → slotIndex) map and a new ordered list of
 * entities, return a new map that preserves existing slots when possible and
 * fills new ones in remaining slots, in order.
 */
export function stableAssign(
  previous: Map<string, number>,
  entities: string[],
  totalSlots: number
): Map<string, number> {
  const next = new Map<string, number>();
  const used = new Set<number>();

  // 1. Carry over previous assignments for entities still present.
  for (const id of entities) {
    const slot = previous.get(id);
    if (slot != null && slot < totalSlots && !used.has(slot)) {
      next.set(id, slot);
      used.add(slot);
    }
  }

  // 2. Fill new entities into the lowest free slot, in entity order.
  let cursor = 0;
  for (const id of entities) {
    if (next.has(id)) continue;
    while (used.has(cursor) && cursor < totalSlots) cursor++;
    if (cursor >= totalSlots) break; // overflow; caller handles "Other"
    next.set(id, cursor);
    used.add(cursor);
    cursor++;
  }

  return next;
}
