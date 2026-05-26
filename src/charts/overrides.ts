/**
 * Per-user color pin: persist (entityId → slotIndex) in localStorage.
 */
const KEY = "chart-entity-color-pins-v1";

type PinMap = Record<string, number>;

function read(): PinMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PinMap) : {};
  } catch {
    return {};
  }
}

function write(map: PinMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function setEntityColor(entityId: string, slotIndex: number) {
  const m = read();
  m[entityId] = slotIndex;
  write(m);
}

export function getEntityColor(entityId: string): number | undefined {
  return read()[entityId];
}

export function clearEntityColors() {
  write({});
}
