import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { paginateByNextCursor } from "../lib/paginate-next-cursor.js";

type ListedPrompt = Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number];

/** Paginated `prompts/list` until `nextCursor` is absent. */
export async function listAllPrompts(client: Client): Promise<ListedPrompt[]> {
  return paginateByNextCursor(async (cursor) => {
    const r = await client.listPrompts(cursor === undefined ? undefined : { cursor });
    return { items: r.prompts, nextCursor: r.nextCursor };
  });
}
