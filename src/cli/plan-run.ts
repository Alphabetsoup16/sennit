import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAggregator } from "../aggregator/build-server.js";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";
import { redactSennitConfig } from "./config-redact.js";
import { runDoctorInspect, type DoctorInspectResult } from "./inspect-upstreams.js";

export type PlanMergedTool = { name: string; description?: string };

export type PlanRunResult = {
  schemaVersion: 1;
  configPath: string | null;
  /** Effective config with `servers.*.env` redacted. */
  config: SennitConfig;
  inspect: DoctorInspectResult;
  mergedTools?: PlanMergedTool[];
  mergedError?: string;
};

/**
 * Resolve path is informational only; `config` must already match `loadSennitConfig(resolved)`.
 */
export async function runPlan(
  configPath: string | null,
  config: SennitConfig,
  inspectTimeoutMs: number,
): Promise<PlanRunResult> {
  const inspect = await runDoctorInspect(config, inspectTimeoutMs);

  let mergedTools: PlanMergedTool[] | undefined;
  let mergedError: string | undefined;
  try {
    const { mcp, close } = await createAggregator(config);
    try {
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      await mcp.connect(serverSide);
      const client = new Client(
        { name: "sennit-plan", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(clientSide);
      try {
        const { tools } = await client.listTools();
        mergedTools = tools.map((t) => ({
          name: t.name,
          description: t.description,
        }));
      } finally {
        await client.close();
      }
    } finally {
      await close();
    }
  } catch (e) {
    mergedError = errorMessage(e);
  }

  return {
    schemaVersion: 1,
    configPath: configPath,
    config: redactSennitConfig(config),
    inspect,
    mergedTools,
    mergedError,
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
