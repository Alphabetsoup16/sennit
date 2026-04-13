import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";
import { namespacedToolName, TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";
import { facadeResourceTemplatePattern, facadeResourceUri } from "../lib/resource-facade.js";
import { listAllResourceTemplates, listAllResources } from "./list-resources.js";
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

type TemplateRow = {
  serverKey: string;
  upstreamUriTemplate: string;
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
  const templateRows: TemplateRow[] = [];
  const seenRegistrationNames = new Set<string>();
  const seenFacadeUris = new Set<string>();
  const seenFacadePatterns = new Set<string>();

  for (const serverKey of hub.configuredServerKeys()) {
    const client = await hub.ensureClient(serverKey);
    if (!client) {
      continue;
    }
    let resources: Awaited<ReturnType<typeof listAllResources>>;
    try {
      resources = await listAllResources(client);
    } catch {
      resources = [];
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

    if (!client.getServerCapabilities()?.resources) {
      continue;
    }
    let templates: Awaited<ReturnType<typeof listAllResourceTemplates>>;
    try {
      templates = await listAllResourceTemplates(client);
    } catch {
      templates = [];
    }
    const allowTpl = config.servers[serverKey]?.resourceTemplates;
    const blockTemplatesFromEmptyResourcesAllowlist =
      allow !== undefined &&
      allow.length === 0 &&
      allowTpl === undefined;
    for (const tmpl of templates) {
      if (blockTemplatesFromEmptyResourcesAllowlist) {
        continue;
      }
      if (allowTpl !== undefined && !allowTpl.includes(tmpl.uriTemplate)) {
        continue;
      }
      const registrationName = namespacedToolName(serverKey, tmpl.name);
      if (seenRegistrationNames.has(registrationName)) {
        throw new Error(`duplicate namespaced resource after merge: ${registrationName}`);
      }
      seenRegistrationNames.add(registrationName);
      const pattern = facadeResourceTemplatePattern(serverKey, tmpl.uriTemplate);
      if (seenFacadePatterns.has(pattern)) {
        throw new Error(`duplicate resource template facade for ${JSON.stringify(serverKey)}`);
      }
      seenFacadePatterns.add(pattern);
      templateRows.push({
        serverKey,
        upstreamUriTemplate: tmpl.uriTemplate,
        registrationName,
        description: tmpl.description,
        mimeType: tmpl.mimeType,
        title: tmpl.title,
      });
    }
  }

  if (rows.length === 0 && templateRows.length === 0) {
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
        const c = await hub.ensureClient(row.serverKey);
        if (!c) {
          throw new Error(`upstream missing: ${row.serverKey}`);
        }
        try {
          const result = await c.readResource({ uri: row.upstreamUri });
          hub.touchActivity(row.serverKey);
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

  for (const row of templateRows) {
    const pattern = facadeResourceTemplatePattern(row.serverKey, row.upstreamUriTemplate);
    const rt = new ResourceTemplate(pattern, { list: undefined });
    mcp.registerResource(
      row.registrationName,
      rt,
      {
        description: row.description,
        mimeType: row.mimeType,
        title: row.title,
      },
      async (uri, variables) => {
        const u = variables["u"];
        if (typeof u !== "string") {
          throw new Error("missing or invalid resource template variable u");
        }
        const c = await hub.ensureClient(row.serverKey);
        if (!c) {
          throw new Error(`upstream missing: ${row.serverKey}`);
        }
        const facadeExpanded = uri.toString();
        try {
          const result = await c.readResource({ uri: u });
          hub.touchActivity(row.serverKey);
          return {
            contents: result.contents.map((item) => ({
              ...item,
              uri: facadeExpanded,
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
  return `Proxied static resources use registration names {serverKey}${TOOL_NAMESPACE_SEPARATOR}{upstreamResourceName} and opaque URIs (${facadeResourceUri("key", "file:///example")} shape). Resource templates use the same naming rule with facade URI templates (${facadeResourceTemplatePattern("key", "file:///example/{name}")} pattern).`;
}
