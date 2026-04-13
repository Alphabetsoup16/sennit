/**
 * Run `fn` with an `AbortSignal` that aborts after `timeoutMs`, and optionally mirrors `parentSignal`.
 * Clears the timer when the returned promise settles. Intended for MCP `Client.callTool(..., { signal })`
 * so timeouts trigger `notifications/cancelled` instead of leaving the JSON-RPC request pending.
 */
export async function withAbortTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
): Promise<T> {
  const combined = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onParentAbort = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    combined.abort(parentSignal!.reason);
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      combined.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener("abort", onParentAbort);
    }
  }

  try {
    combined.signal.throwIfAborted();
    timer = setTimeout(() => {
      timer = undefined;
      combined.abort(new Error(`operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    return await fn(combined.signal);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}
