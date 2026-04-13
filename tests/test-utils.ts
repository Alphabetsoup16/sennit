import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Root } from "@modelcontextprotocol/sdk/types.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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

/**
 * Like {@link withInMemoryAggregator}, but the in-memory host `Client` advertises `roots` and
 * answers `roots/list` with `hostRoots` (for stdio tests that call `listRoots` upstream).
 */
export async function withInMemoryAggregatorAndHostRoots(
  config: z.input<typeof sennitConfigSchema>,
  hostRoots: Root[],
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const parsed = sennitConfigSchema.parse(config);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const { mcp, close } = await createAggregator(parsed);
  await mcp.connect(serverSide);
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots: hostRoots }));
  await client.connect(clientSide);
  try {
    await run(client);
  } finally {
    await client.close();
    await close();
  }
}
