import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

type ListedPrompt = Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number];

/** Paginated `prompts/list` until `nextCursor` is absent. */
export async function listAllPrompts(client: Client): Promise<ListedPrompt[]> {
  const out: ListedPrompt[] = [];
  let cursor: string | undefined;
  for (;;) {
    const r = await client.listPrompts(cursor === undefined ? undefined : { cursor });
    out.push(...r.prompts);
    const next = r.nextCursor;
    if (!next) {
      break;
    }
    cursor = next;
  }
  return out;
}
