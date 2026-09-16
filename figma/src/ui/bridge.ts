import type { Request, Response, SelectionPayload, SelectionPush } from "../shared/protocol";

/**
 * Omit over a union collapses to the keys every member shares, which erases the
 * discriminant. Distributing it keeps each request shape intact.
 */
type WithoutId<T> = T extends { id: string } ? Omit<T, "id"> : never;
export type RequestInit = WithoutId<Request>;

let seq = 0;
const pending = new Map<string, (r: Response) => void>();
const selectionListeners = new Set<(p: SelectionPayload) => void>();

/** Exported for tests: drives the bridge without a real iframe. */
export function __handleMessage(data: unknown): void {
  const msg = (data as { pluginMessage?: Response | SelectionPush })?.pluginMessage;
  if (!msg) return;

  if ((msg as SelectionPush).type === "selection-changed") {
    const push = msg as SelectionPush;
    selectionListeners.forEach((fn) => fn(push.payload));
    return;
  }

  const res = msg as Response;
  if (typeof res.id !== "string") return;
  const resolve = pending.get(res.id);
  if (!resolve) return;
  pending.delete(res.id);
  resolve(res);
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e: MessageEvent) => __handleMessage(e.data));
}

export function onSelectionChange(fn: (p: SelectionPayload) => void): () => void {
  selectionListeners.add(fn);
  return () => selectionListeners.delete(fn);
}

/**
 * A failure reply resolves rather than rejects, so every caller has to handle
 * the reason instead of letting a catch-all swallow it.
 */
export function send(req: RequestInit): Promise<Response> {
  const id = `r${++seq}-${Date.now()}`;
  return new Promise<Response>((resolve) => {
    pending.set(id, resolve);
    parent.postMessage({ pluginMessage: { ...req, id } }, "*");
  });
}
