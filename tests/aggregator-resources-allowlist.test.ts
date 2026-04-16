import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listAllResourceTemplates, listAllResources } from "../src/aggregator/list-resources.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { withInMemoryAggregator } from "./test-utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("createAggregator resources allowlist", () => {
  it("exposes no resources when servers.*.resources is empty array", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    await withInMemoryAggregator(
      sennitConfigSchema.parse({
        version: 1,
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [mockPath],
            resources: [],
          },
        },
      }),
      async (client) => {
        // No façade resources registered → Sennit omits `resources` capability; `resources/list` is unsupported.
        await expect(listAllResources(client)).rejects.toThrow(/Method not found|-32601/);
      },
    );
  });

  it("keeps only URIs listed in servers.*.resources", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    await withInMemoryAggregator(
      sennitConfigSchema.parse({
        version: 1,
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [mockPath],
            resources: ["file:///mock/readme.md"],
          },
        },
      }),
      async (client) => {
        const resources = await listAllResources(client);
        expect(resources.map((r) => r.name)).toEqual(["mock__mock.readme"]);
      },
    );
  });

  it("exposes only resource templates when resources allowlist is empty but resourceTemplates is set", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    await withInMemoryAggregator(
      sennitConfigSchema.parse({
        version: 1,
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [mockPath],
            resources: [],
            resourceTemplates: ["file:///mock/dynamic/{name}"],
          },
        },
      }),
      async (client) => {
        const resources = await listAllResources(client);
        expect(resources).toEqual([]);
        const templates = await listAllResourceTemplates(client);
        expect(templates.map((t) => t.name)).toEqual(["mock__mock.dynamic"]);
      },
    );
  });
});
