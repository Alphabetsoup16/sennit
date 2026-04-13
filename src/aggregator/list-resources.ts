import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { paginateByNextCursor } from "../lib/paginate-next-cursor.js";

type ListedResource = Awaited<ReturnType<Client["listResources"]>>["resources"][number];
type ListedResourceTemplate = Awaited<
  ReturnType<Client["listResourceTemplates"]>
>["resourceTemplates"][number];

/** Paginated `resources/list` until `nextCursor` is absent. */
export async function listAllResources(client: Client): Promise<ListedResource[]> {
  return paginateByNextCursor(async (cursor) => {
    const r = await client.listResources(cursor === undefined ? undefined : { cursor });
    return { items: r.resources, nextCursor: r.nextCursor };
  });
}

/** Paginated `resources/templates/list` until `nextCursor` is absent. */
export async function listAllResourceTemplates(
  client: Client,
): Promise<ListedResourceTemplate[]> {
  return paginateByNextCursor(async (cursor) => {
    const r = await client.listResourceTemplates(
      cursor === undefined ? undefined : { cursor },
    );
    return { items: r.resourceTemplates, nextCursor: r.nextCursor };
  });
}
