/** Stable `Error#message` extraction for catch blocks and CLI output. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
