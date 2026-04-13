import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { z } from "zod";
import { createAggregator } from "../src/aggregator/build-server.js";
import { sennitConfigSchema } from "../src/config/schema.js";

/** Aggregator + MCP client over `InMemoryTransport`; always closes both sides. */
export async function withInMemoryAggregator(
  config: z.input<typeof sennitConfigSchema>,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const parsed = sennitConfigSchema.parse(config);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const { mcp, close } = await createAggregator(parsed);
  await mcp.connect(serverSide);
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(clientSide);
  try {
    await run(client);
  } finally {
    await client.close();
    await close();
  }
}
