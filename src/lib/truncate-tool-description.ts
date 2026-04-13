/**
 * Shorten host-facing tool descriptions to save model context (lossy). Used only for merged
 * `tools/list` metadata, not for `tools/call` payloads.
 */
export function truncateForToolList(text: string, maxChars: number | undefined): string {
  if (maxChars === undefined || text.length <= maxChars) {
    return text;
  }
  const ellipsis = "…";
  const sliceLen = Math.max(0, maxChars - ellipsis.length);
  return sliceLen === 0 ? ellipsis : `${text.slice(0, sliceLen)}${ellipsis}`;
}
