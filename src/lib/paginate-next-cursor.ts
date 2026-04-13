/**
 * Exhaust an MCP-style paginated list until `nextCursor` is absent from the response.
 */
export async function paginateByNextCursor<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor?: string }>,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const { items, nextCursor } = await fetchPage(cursor);
    out.push(...items);
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }
  return out;
}
