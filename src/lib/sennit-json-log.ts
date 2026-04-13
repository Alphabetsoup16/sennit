/**
 * Structured stderr logs when `SENNIT_LOG=json` is set (one JSON object per line).
 */
export function sennitJsonLog(event: string, fields: Record<string, unknown>): void {
  if (process.env.SENNIT_LOG !== "json") {
    return;
  }
  process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), event, ...fields })}\n`);
}
