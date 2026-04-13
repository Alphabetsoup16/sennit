import { errorMessage } from "../lib/error-message.js";
import type { UpstreamHub } from "./upstream-hub.js";

export type BatchCallItem = {
  serverKey: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  clientCallId: string;
};

export type BatchCallResultItem =
  | { clientCallId: string; ok: true; result: unknown }
  | { clientCallId: string; ok: false; error: string };

/** Run many upstream `tools/call` operations in parallel (one Client per serverKey). */
export async function executeBatchCall(
  hub: UpstreamHub,
  calls: BatchCallItem[],
  options?: { signal?: AbortSignal },
): Promise<BatchCallResultItem[]> {
  return Promise.all(
    calls.map(async (item): Promise<BatchCallResultItem> => {
      try {
        const client = await hub.ensureClient(item.serverKey);
        if (!client) {
          return {
            clientCallId: item.clientCallId,
            ok: false,
            error: `unknown serverKey: ${item.serverKey}`,
          };
        }
        const result = await client.callTool(
          {
            name: item.toolName,
            arguments: (item.arguments ?? {}) as Record<string, unknown>,
          },
          undefined,
          options,
        );
        hub.touchActivity(item.serverKey);
        return { clientCallId: item.clientCallId, ok: true, result };
      } catch (e) {
        return { clientCallId: item.clientCallId, ok: false, error: errorMessage(e) };
      }
    }),
  );
}
