import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { errorMessage } from "../lib/error-message.js";
import { listAllPrompts } from "./list-prompts.js";
import { listAllResources } from "./list-resources.js";
import type { DoctorInspectResult, DoctorInspectUpstream } from "./doctor-inspect-types.js";
import type { UpstreamHub } from "./upstream-hub.js";

type ListedTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];
type ListedPrompt = Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number];

export type UpstreamProbeOkRow = {
  serverKey: string;
  ok: true;
  tools: ListedTool[];
  /** Present when upstream advertises `prompts` and listing succeeded. */
  prompts?: ListedPrompt[];
  resourceCount?: number;
};

export type UpstreamProbeErrRow = {
  serverKey: string;
  ok: false;
  error: string;
};

export type UpstreamProbeRow = UpstreamProbeOkRow | UpstreamProbeErrRow;

/**
 * After `hub.connect`, list tools (and best-effort resource counts) per upstream.
 * Per-upstream failures are captured in rows (doctor-inspect semantics), not thrown.
 */
export async function probeConnectedHub(hub: UpstreamHub): Promise<UpstreamProbeRow[]> {
  const keys = hub.configuredServerKeys();
  return Promise.all(
    keys.map(async (serverKey) => {
      try {
        const client = await hub.ensureClient(serverKey);
        if (!client) {
          return { serverKey, ok: false as const, error: `unknown serverKey: ${serverKey}` };
        }
        const { tools } = await client.listTools();
        let resourceCount: number | undefined;
        try {
          const resources = await listAllResources(client);
          resourceCount = resources.length;
        } catch {
          // Upstream may not advertise resources — omit resourceCount.
        }
        let prompts: ListedPrompt[] | undefined;
        if (client.getServerCapabilities()?.prompts) {
          try {
            prompts = await listAllPrompts(client);
          } catch {
            prompts = [];
          }
        }
        return { serverKey, ok: true as const, tools, prompts, resourceCount };
      } catch (e) {
        return { serverKey, ok: false as const, error: errorMessage(e) };
      }
    }),
  );
}

export function doctorInspectResultFromProbeRows(rows: UpstreamProbeRow[]): DoctorInspectResult {
  const upstreams: DoctorInspectUpstream[] = rows.map((r) => {
    if (r.ok) {
      const toolNames = r.tools.map((t) => t.name);
      return {
        serverKey: r.serverKey,
        ok: true,
        toolCount: toolNames.length,
        toolNames,
        promptCount: r.prompts?.length,
        promptNames: r.prompts?.map((p) => p.name),
        resourceCount: r.resourceCount,
      };
    }
    return { serverKey: r.serverKey, ok: false, error: r.error };
  });
  return { schemaVersion: 1, ok: upstreams.every((u) => u.ok), upstreams };
}

/** Tool catalogs for registration; throws if any probe row failed (createAggregator semantics). */
export function toolCatalogsFromProbeRowsOrThrow(rows: UpstreamProbeRow[]): Array<{
  serverKey: string;
  tools: ListedTool[];
}> {
  const firstBad = rows.find((r): r is UpstreamProbeErrRow => !r.ok);
  if (firstBad) {
    throw new Error(firstBad.error);
  }
  return (rows as UpstreamProbeOkRow[]).map((r) => ({ serverKey: r.serverKey, tools: r.tools }));
}

/** Prompt catalogs for registration; throws if any probe row failed (createAggregator semantics). */
export function promptCatalogsFromProbeRowsOrThrow(rows: UpstreamProbeRow[]): Array<{
  serverKey: string;
  prompts: ListedPrompt[];
}> {
  const firstBad = rows.find((r): r is UpstreamProbeErrRow => !r.ok);
  if (firstBad) {
    throw new Error(firstBad.error);
  }
  return (rows as UpstreamProbeOkRow[]).map((r) => ({
    serverKey: r.serverKey,
    prompts: r.prompts ?? [],
  }));
}
