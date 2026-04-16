import { errorMessage } from "../lib/error-message.js";
import { withAbortTimeout } from "../lib/with-timeout.js";
import type { UpstreamHub } from "./upstream-hub.js";

export type BatchCallItem = {
  serverKey: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  clientCallId: string;
};

export type BatchCallResultItem =
  | { clientCallId: string; ok: true; result: unknown }
  | { clientCallId: string; ok: false; error: string };

export type ExecuteBatchCallOptions = {
  signal?: AbortSignal;
  /** When set, at most this many upstream calls run at once. */
  maxConcurrency?: number;
  toolCallTimeoutMsForServer?: (serverKey: string) => number | undefined;
};

async function callToolForBatchItem(
  hub: UpstreamHub,
  item: BatchCallItem,
  opts: { timeoutMs?: number; batchSignal?: AbortSignal },
): Promise<unknown> {
  const params = {
    name: item.toolName,
    arguments: (item.arguments ?? {}) as Record<string, unknown>,
  };
  if (opts.timeoutMs !== undefined) {
    return withAbortTimeout(
      opts.timeoutMs,
      (signal) => hub.callTool(item.serverKey, params, { signal }),
      opts.batchSignal,
    );
  }
  return hub.callTool(item.serverKey, params, { signal: opts.batchSignal });
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number | undefined,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (concurrency === undefined || concurrency <= 0 || concurrency >= items.length) {
    return Promise.all(items.map((item, i) => fn(item, i)));
  }
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) {
        return;
      }
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

/** Run many upstream `tools/call` operations in parallel (one Client per serverKey). */
export async function executeBatchCall(
  hub: UpstreamHub,
  calls: BatchCallItem[],
  options?: ExecuteBatchCallOptions,
): Promise<BatchCallResultItem[]> {
  const maxConcurrency = options?.maxConcurrency;
  const timeoutFor = options?.toolCallTimeoutMsForServer;

  return mapWithConcurrency(calls, maxConcurrency, async (item): Promise<BatchCallResultItem> => {
    try {
      const result = await callToolForBatchItem(hub, item, {
        timeoutMs: timeoutFor?.(item.serverKey),
        batchSignal: options?.signal,
      });
      hub.touchActivity(item.serverKey);
      return { clientCallId: item.clientCallId, ok: true, result };
    } catch (e) {
      return { clientCallId: item.clientCallId, ok: false, error: errorMessage(e) };
    }
  });
}
