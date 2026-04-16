import { describe, expect, it } from "vitest";
import { executeBatchCall } from "../src/aggregator/batch.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { UpstreamHub } from "../src/aggregator/upstream-hub.js";

function stubHub(
  impl: Record<
    string,
    (
      name: string,
      args: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<unknown>
  >,
): UpstreamHub {
  const hub = {
    async callTool(
      serverKey: string,
      params: { name: string; arguments?: Record<string, unknown> },
      options?: { signal?: AbortSignal },
    ) {
      const fn = impl[serverKey];
      if (!fn) {
        throw new Error(`unknown serverKey: ${serverKey}`);
      }
      return fn(params.name, params.arguments ?? {}, options);
    },
    async ensureClient(key: string) {
      const fn = impl[key];
      if (!fn) return undefined;
      return {
        callTool: (
          params: { name: string; arguments: Record<string, unknown> },
          _resultSchema?: unknown,
          options?: { signal?: AbortSignal },
        ) => fn(params.name, params.arguments, options) as ReturnType<Client["callTool"]>,
      } as Client;
    },
    touchActivity: () => undefined,
  };
  return hub as unknown as UpstreamHub;
}

describe("executeBatchCall", () => {
  it("returns ok with correlated clientCallId", async () => {
    const hub = stubHub({
      a: async () => ({ content: [{ type: "text", text: "ok" }] }),
    });
    const out = await executeBatchCall(hub, [
      { serverKey: "a", toolName: "t", clientCallId: "x1" },
    ]);
    expect(out).toEqual([
      {
        clientCallId: "x1",
        ok: true,
        result: { content: [{ type: "text", text: "ok" }] },
      },
    ]);
  });

  it("marks unknown serverKey as error", async () => {
    const hub = stubHub({});
    const out = await executeBatchCall(hub, [
      { serverKey: "missing", toolName: "t", clientCallId: "c1" },
    ]);
    expect(out[0]).toMatchObject({
      clientCallId: "c1",
      ok: false,
      error: expect.stringMatching(/unknown serverKey/),
    });
  });

  it("runs independent calls concurrently (not sequentially)", async () => {
    const delay = 40;
    let inFlight = 0;
    let maxConcurrent = 0;
    const hub = stubHub({
      a: async () => {
        inFlight += 1;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        await new Promise((r) => setTimeout(r, delay));
        inFlight -= 1;
        return { content: [{ type: "text", text: "a" }] };
      },
    });
    const t0 = Date.now();
    await executeBatchCall(hub, [
      { serverKey: "a", toolName: "t1", clientCallId: "1" },
      { serverKey: "a", toolName: "t2", clientCallId: "2" },
    ]);
    const elapsed = Date.now() - t0;
    expect(maxConcurrent).toBe(2);
    expect(elapsed).toBeLessThan(delay * 2 - 10);
  });

  it("respects maxConcurrency when lower than call count", async () => {
    const delay = 30;
    let inFlight = 0;
    let maxInFlight = 0;
    const hub = stubHub({
      a: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, delay));
        inFlight -= 1;
        return { content: [{ type: "text", text: "ok" }] };
      },
    });
    const calls = Array.from({ length: 8 }, (_, i) => ({
      serverKey: "a",
      toolName: "t",
      clientCallId: `c${i}`,
    }));
    const out = await executeBatchCall(hub, calls, { maxConcurrency: 2 });
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(out).toHaveLength(8);
    expect(out.every((r) => r.ok)).toBe(true);
  });

  it("returns per-call failure when AbortSignal is already aborted (forwards SDK-style abort)", async () => {
    const hub = stubHub({
      a: async (_name, _args, opts) => {
        if (opts?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return { content: [{ type: "text", text: "ok" }] };
      },
    });
    const ac = new AbortController();
    ac.abort();
    const out = await executeBatchCall(
      hub,
      [{ serverKey: "a", toolName: "t", clientCallId: "c1" }],
      { signal: ac.signal },
    );
    expect(out[0]).toMatchObject({
      clientCallId: "c1",
      ok: false,
      error: expect.stringMatching(/abort/i),
    });
  });

  it("isolates failures between calls", async () => {
    const hub = stubHub({
      good: async () => ({ content: [{ type: "text", text: "y" }] }),
      bad: async () => {
        throw new Error("upstream boom");
      },
    });
    const out = await executeBatchCall(hub, [
      { serverKey: "good", toolName: "t", clientCallId: "g" },
      { serverKey: "bad", toolName: "t", clientCallId: "b" },
    ]);
    expect(out.find((r) => r.clientCallId === "g")).toMatchObject({ ok: true });
    expect(out.find((r) => r.clientCallId === "b")).toMatchObject({
      ok: false,
      error: "upstream boom",
    });
  });
});
