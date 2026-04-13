import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  connectAndProbeWithTimeout,
  createAggregator,
  finalizeAggregatorHandle,
  registerAggregatorSurface,
  type AggregatorHandle,
} from "../aggregator/build-server.js";
import { listAllPrompts } from "../aggregator/list-prompts.js";
import { listAllResources } from "../aggregator/list-resources.js";
import {
  promptCatalogsFromProbeRowsOrThrow,
  toolCatalogsFromProbeRowsOrThrow,
} from "../aggregator/upstream-probe.js";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";
import type { DoctorInspectResult } from "../aggregator/doctor-inspect-types.js";
import { redactSennitConfig } from "./config-redact.js";

export type PlanMergedTool = { name: string; description?: string };

export type PlanMergedResource = { name: string; uri: string; description?: string };

export type PlanMergedPrompt = { name: string; description?: string; title?: string };

export type PlanRunResult = {
  schemaVersion: 1;
  configPath: string | null;
  /** Effective config with `servers.*.env` redacted. */
  config: SennitConfig;
  inspect: DoctorInspectResult;
  mergedTools?: PlanMergedTool[];
  mergedError?: string;
  mergedResources?: PlanMergedResource[];
  mergedPrompts?: PlanMergedPrompt[];
};

async function captureMergedCatalog(handle: AggregatorHandle): Promise<{
  mergedTools: PlanMergedTool[];
  mergedResources: PlanMergedResource[];
  mergedPrompts: PlanMergedPrompt[];
}> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await handle.mcp.connect(serverSide);
  const client = new Client({ name: "sennit-plan", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientSide);
  try {
    const { tools } = await client.listTools();
    const mergedTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
    let mergedResources: PlanMergedResource[];
    try {
      const resources = await listAllResources(client);
      mergedResources = resources.map((r) => ({
        name: r.name,
        uri: r.uri,
        description: r.description,
      }));
    } catch {
      mergedResources = [];
    }
    let mergedPrompts: PlanMergedPrompt[];
    try {
      const prompts = await listAllPrompts(client);
      mergedPrompts = prompts.map((p) => ({
        name: p.name,
        description: p.description,
        title: p.title,
      }));
    } catch {
      mergedPrompts = [];
    }
    return { mergedTools, mergedResources, mergedPrompts };
  } finally {
    await client.close();
  }
}

/**
 * Resolve path is informational only; `config` must already match `loadSennitConfig(resolved)`.
 *
 * Uses one upstream connect when the timed connect+probe phase succeeds; on timeout/fatal inspect,
 * falls back to a full `createAggregator` for the merged catalog (same as legacy behavior).
 */
export async function runPlan(
  configPath: string | null,
  config: SennitConfig,
  inspectTimeoutMs: number,
): Promise<PlanRunResult> {
  const phase = await connectAndProbeWithTimeout(config, inspectTimeoutMs);
  const inspect = phase.inspect;

  let mergedTools: PlanMergedTool[] | undefined;
  let mergedError: string | undefined;
  let mergedResources: PlanMergedResource[] | undefined;
  let mergedPrompts: PlanMergedPrompt[] | undefined;

  if (!phase.fatal) {
    try {
      const catalogs = toolCatalogsFromProbeRowsOrThrow(phase.rows);
      const promptCatalogs = promptCatalogsFromProbeRowsOrThrow(phase.rows);
      await registerAggregatorSurface(
        phase.mcp,
        phase.hub,
        config,
        catalogs,
        promptCatalogs,
        phase.rootsBridge,
      );
      const handle = finalizeAggregatorHandle(phase.mcp, phase.hub);
      try {
        const captured = await captureMergedCatalog(handle);
        mergedTools = captured.mergedTools;
        mergedResources = captured.mergedResources;
        mergedPrompts = captured.mergedPrompts;
      } finally {
        await handle.close();
      }
    } catch (e) {
      mergedError = errorMessage(e);
      await phase.mcp.close().catch(() => undefined);
      await phase.hub.close().catch(() => undefined);
    }
  } else {
    try {
      const handle = await createAggregator(config);
      try {
        const captured = await captureMergedCatalog(handle);
        mergedTools = captured.mergedTools;
        mergedResources = captured.mergedResources;
        mergedPrompts = captured.mergedPrompts;
      } finally {
        await handle.close();
      }
    } catch (e) {
      mergedError = errorMessage(e);
    }
  }

  return {
    schemaVersion: 1,
    configPath: configPath,
    config: redactSennitConfig(config),
    inspect,
    mergedTools,
    mergedError,
    mergedResources,
    mergedPrompts,
  };
}

export function planOverallOk(r: PlanRunResult): boolean {
  return (
    r.inspect.ok &&
    !r.inspect.fatalError &&
    r.mergedError === undefined &&
    r.mergedTools !== undefined
  );
}
