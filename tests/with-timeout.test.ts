import { describe, expect, it, vi } from "vitest";
import { withAbortTimeout } from "../src/lib/with-timeout.js";

function promiseRejectedOnAbort<T = void>(
  signal: AbortSignal,
  body?: () => void,
): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    body?.();
  });
}

describe("withAbortTimeout", () => {
  it("aborts the signal when the deadline passes (promise follows abort)", async () => {
    const fn = vi.fn((signal: AbortSignal) => promiseRejectedOnAbort(signal));
    await expect(withAbortTimeout(15, fn)).rejects.toThrow(/timed out after 15ms/);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("clears the timer when fn resolves", async () => {
    const r = await withAbortTimeout(30_000, async (signal) => {
      expect(signal.aborted).toBe(false);
      return 7;
    });
    expect(r).toBe(7);
  });

  it("aborts early when parent is already aborted", async () => {
    const parent = new AbortController();
    parent.abort(new Error("nope"));
    await expect(
      withAbortTimeout(30_000, async () => 1, parent.signal),
    ).rejects.toThrow("nope");
  });

  it("aborts when parent aborts mid-flight", async () => {
    const parent = new AbortController();
    const p = withAbortTimeout(
      30_000,
      (signal) => promiseRejectedOnAbort(signal, () => queueMicrotask(() => parent.abort(new Error("cancelled")))),
      parent.signal,
    );
    await expect(p).rejects.toThrow("cancelled");
  });
});
