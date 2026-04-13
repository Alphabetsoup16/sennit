/** Wrap `fetch` so the returned promise rejects after `timeoutMs` even if the inner `fetch` ignores `AbortSignal`. */
export function wrapFetchWithDeadline(timeoutMs: number, baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return (input, init) => {
    const ctrl = new AbortController();
    const parent = init?.signal;
    const onParentAbort = () => {
      ctrl.abort(parent?.reason);
    };
    if (parent) {
      if (parent.aborted) {
        return Promise.reject(parent.reason);
      }
      parent.addEventListener("abort", onParentAbort, { once: true });
    }

    const fetchPromise = baseFetch(input, { ...init, signal: ctrl.signal });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        ctrl.abort(new DOMException(`fetch timed out after ${timeoutMs}ms`, "TimeoutError"));
        reject(new DOMException(`fetch timed out after ${timeoutMs}ms`, "TimeoutError"));
      }, timeoutMs);
    });

    return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
      if (parent) {
        parent.removeEventListener("abort", onParentAbort);
      }
    });
  };
}
