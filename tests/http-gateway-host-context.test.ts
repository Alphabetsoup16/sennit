import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  ListRootsRequestSchema,
  type Root,
} from "@modelcontextprotocol/sdk/types.js";
import { startServeHttpGateway } from "../src/cli/serve-http-gateway.js";
import { firstTextBlock } from "./mcp-helpers.js";
import { distMockContextUpstreamPath } from "./cli-fixtures.js";

type GatewayHandle = Awaited<ReturnType<typeof startServeHttpGateway>>;

describe("HTTP gateway host session context", () => {
  const clients: Client[] = [];
  let gateway: GatewayHandle | undefined;

  afterEach(async () => {
    await gateway?.close().catch(() => undefined);
    gateway = undefined;
    for (const c of clients.splice(0, clients.length)) {
      await c.close().catch(() => undefined);
    }
  });

  it("keeps roots/sampling/elicitation bound to the invoking host session", async () => {
    gateway = await startServeHttpGateway(
      {
        version: 1,
        roots: { mode: "forward" },
        servers: {
          ctx: {
            transport: "stdio",
            command: process.execPath,
            args: [distMockContextUpstreamPath()],
          },
        },
      },
      {
        host: "127.0.0.1",
        port: 0,
        mcpPath: "/mcp",
        healthPath: "/healthz",
        readyPath: "/ready",
      },
    );
    const addr = gateway.server.address() as AddressInfo;
    const url = new URL(`http://127.0.0.1:${addr.port}/mcp`);

    async function makeClient(identity: string, roots: Root[]): Promise<Client> {
      const client = new Client(
        { name: `host-${identity}`, version: "1.0.0" },
        { capabilities: { roots: {}, sampling: {}, elicitation: { form: {} } } },
      );
      client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots }));
      client.setRequestHandler(CreateMessageRequestSchema, async () => ({
        role: "assistant",
        model: "test",
        content: { type: "text", text: `sample:${identity}` },
        stopReason: "endTurn",
      }));
      client.setRequestHandler(ElicitRequestSchema, async () => ({
        action: "accept",
        content: { who: identity },
      }));
      await client.connect(new StreamableHTTPClientTransport(url));
      clients.push(client);
      return client;
    }

    const a = await makeClient("A", [{ uri: "file:///A", name: "A" }]);
    await makeClient("B", [{ uri: "file:///B", name: "B" }]); // last-connected on purpose

    const rootsOut = await a.callTool({ name: "ctx__mock.rootsSnapshot", arguments: {} });
    expect(JSON.parse(firstTextBlock(rootsOut)) as Root[]).toEqual([{ uri: "file:///A", name: "A" }]);

    const sampleOut = await a.callTool({ name: "ctx__mock.sampleIdentity", arguments: {} });
    expect(firstTextBlock(sampleOut)).toBe("sample:A");

    const elicitOut = await a.callTool({ name: "ctx__mock.elicitIdentity", arguments: {} });
    expect(JSON.parse(firstTextBlock(elicitOut))).toMatchObject({ action: "accept", content: { who: "A" } });
  });
});
