/** Default wall-clock budget for `doctor inspect` (connect + all `tools/list`). */
export const DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS = 30_000;

/**
 * Parse a positive millisecond timeout from CLI text (e.g. Commander option string).
 * @param flagLabel e.g. `--timeout` (shown in thrown errors)
 */
export function parsePositiveTimeoutMs(
  raw: string | undefined,
  fallback: number,
  flagLabel: string,
): number {
  if (raw === undefined || raw.length === 0) {
    return fallback;
  }
  return parseRequiredPositiveMs(raw, flagLabel);
}

/**
 * Parse a required positive millisecond value (e.g. Commander option that always receives a string).
 */
export function parseRequiredPositiveMs(raw: string, flagLabel: string): number {
  if (raw.length === 0) {
    throw new Error(`invalid ${flagLabel}: (empty) (expected positive milliseconds)`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`invalid ${flagLabel}: ${raw} (expected positive milliseconds)`);
  }
  return Math.floor(n);
}
