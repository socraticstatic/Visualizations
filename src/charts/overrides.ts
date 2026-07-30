/**
 * Per-user color pin: persist (entityId → slotIndex) in localStorage.
 *
 * Uses `window.localStorage` explicitly: under Node 22+ a global
 * `localStorage` exists that is disabled unless `--localstorage-file` is set,
 * and silently swallowing its errors made pins no-ops in tests. When no
 * working storage is available, an in-memory map keeps pins working for the
 * lifetime of the session.
 */
const KEY = "chart-entity-color-pins-v1";

type PinMap = Record<string, number>;

const memory = new Map<string, string>();

function store(): Pick<Storage, "getItem" | "setItem"> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      // Probe: some environments expose a storage object whose methods throw.
      window.localStorage.getItem(KEY);
      return window.localStorage;
    }
  } catch {
    /* fall through to memory */
  }
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };
}

function read(): PinMap {
  try {
    const raw = store().getItem(KEY);
    return raw ? (JSON.parse(raw) as PinMap) : {};
  } catch {
    return {};
  }
}

function write(map: PinMap) {
  try {
    store().setItem(KEY, JSON.stringify(map));
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

export function clearEntityColor(entityId: string) {
  const m = read();
  delete m[entityId];
  write(m);
}

export function clearEntityColors() {
  write({});
}
