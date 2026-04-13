import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

type ListedResource = Awaited<ReturnType<Client["listResources"]>>["resources"][number];

/** Paginated `resources/list` until `nextCursor` is absent. */
export async function listAllResources(client: Client): Promise<ListedResource[]> {
  const out: ListedResource[] = [];
  let cursor: string | undefined;
  for (;;) {
    const r = await client.listResources(cursor === undefined ? undefined : { cursor });
    out.push(...r.resources);
    const next = r.nextCursor;
    if (!next) {
      break;
    }
    cursor = next;
  }
  return out;
}
