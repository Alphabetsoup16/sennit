/** Stable JSON for tool responses and CLI output. */
export function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
