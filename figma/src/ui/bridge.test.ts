import { describe, it, expect, vi, beforeEach } from "vitest";
import { send, __handleMessage, onSelectionChange } from "./bridge";

beforeEach(() => {
  (globalThis as any).parent = { postMessage: vi.fn() };
});

const lastPosted = () =>
  (globalThis as any).parent.postMessage.mock.calls.at(-1)[0].pluginMessage;

describe("send", () => {
  it("posts a request with a unique id and resolves on the matching reply", async () => {
    const p = send({ type: "read-selection" });
    const posted = lastPosted();
    expect(posted.type).toBe("read-selection");
    __handleMessage({ pluginMessage: { id: posted.id, ok: true, type: "selection", payload: { nodes: [], backdrop: [] } } });
    await expect(p).resolves.toMatchObject({ ok: true, type: "selection" });
  });

  it("ignores a reply whose id does not match", async () => {
    const p = send({ type: "store-get" });
    const posted = lastPosted();
    __handleMessage({ pluginMessage: { id: "someone-else", ok: true, type: "stored" } });
    expect(await Promise.race([p.then(() => "resolved"), Promise.resolve("pending")])).toBe("pending");
    __handleMessage({ pluginMessage: { id: posted.id, ok: true, type: "stored" } });
    await expect(p).resolves.toMatchObject({ ok: true });
  });

  it("resolves rather than rejects on failure, so callers must handle it", async () => {
    const p = send({ type: "read-selection" });
    __handleMessage({ pluginMessage: { id: lastPosted().id, ok: false, reason: "no-selection", detail: "x" } });
    expect((await p).ok).toBe(false);
  });

  it("gives every request a distinct id", () => {
    send({ type: "store-get" });
    const first = lastPosted().id;
    send({ type: "store-get" });
    expect(lastPosted().id).not.toBe(first);
  });
});

describe("onSelectionChange", () => {
  it("delivers pushes that carry no id, and unsubscribes", () => {
    const seen: number[] = [];
    const off = onSelectionChange((p) => seen.push(p.nodes.length));
    __handleMessage({ pluginMessage: { type: "selection-changed", payload: { nodes: [{}], backdrop: [] } } });
    expect(seen).toEqual([1]);
    off();
    __handleMessage({ pluginMessage: { type: "selection-changed", payload: { nodes: [], backdrop: [] } } });
    expect(seen).toEqual([1]);
  });
});
