import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";
import { namespacedToolName, TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";
import { facadeResourceUri } from "../lib/resource-facade.js";
import { listAllResources } from "./list-resources.js";
import type { UpstreamHub } from "./upstream-hub.js";

type ResourceRow = {
  serverKey: string;
  upstreamUri: string;
  facadeUri: string;
  registrationName: string;
  description?: string;
  mimeType?: string;
  title?: string;
};

/**
 * Merge static `resources/list` entries from each upstream, register host-facing URIs and read proxies.
 * Resource **registration names** use the same `{serverKey}__{upstreamName}` rule as tools.
 * **URIs** are opaque `urn:sennit:resource:v1:…` values; `resources/read` fans out to the owning upstream.
 */
export async function registerProxyResources(
  mcp: McpServer,
  hub: UpstreamHub,
  config: SennitConfig,
): Promise<void> {
  const rows: ResourceRow[] = [];
  const seenRegistrationNames = new Set<string>();
  const seenFacadeUris = new Set<string>();

  for (const [serverKey, client] of hub.entries()) {
    let resources: Awaited<ReturnType<typeof listAllResources>>;
    try {
      resources = await listAllResources(client);
    } catch {
      continue;
    }

    const allow = config.servers[serverKey]?.resources;

    for (const res of resources) {
      if (allow && !allow.includes(res.uri)) {
        continue;
      }

      const registrationName = namespacedToolName(serverKey, res.name);
      if (seenRegistrationNames.has(registrationName)) {
        throw new Error(`duplicate namespaced resource after merge: ${registrationName}`);
      }
      seenRegistrationNames.add(registrationName);

      const facadeUri = facadeResourceUri(serverKey, res.uri);
      if (seenFacadeUris.has(facadeUri)) {
        throw new Error(
          `duplicate upstream resource URI for server ${JSON.stringify(serverKey)}: ${JSON.stringify(res.uri)}`,
        );
      }
      seenFacadeUris.add(facadeUri);
      rows.push({
        serverKey,
        upstreamUri: res.uri,
        facadeUri,
        registrationName,
        description: res.description,
        mimeType: res.mimeType,
        title: res.title,
      });
    }
  }

  if (rows.length === 0) {
    return;
  }

  mcp.server.registerCapabilities({ resources: {} });

  for (const row of rows) {
    mcp.registerResource(
      row.registrationName,
      row.facadeUri,
      {
        description: row.description,
        mimeType: row.mimeType,
        title: row.title,
      },
      async () => {
        const c = hub.get(row.serverKey);
        if (!c) {
          throw new Error(`upstream missing: ${row.serverKey}`);
        }
        try {
          const result = await c.readResource({ uri: row.upstreamUri });
          return {
            contents: result.contents.map((item) => ({
              ...item,
              uri: row.facadeUri,
            })),
            _meta: result._meta,
          };
        } catch (e) {
          const msg = errorMessage(e);
          throw new Error(msg, { cause: e });
        }
      },
    );
  }
}

/** For operator docs / meta JSON. */
export function resourceNamespacingSummary(): string {
  return `Proxied static resources use registration names {serverKey}${TOOL_NAMESPACE_SEPARATOR}{upstreamResourceName} and opaque URIs (${facadeResourceUri("key", "file:///example")} shape).`;
}
