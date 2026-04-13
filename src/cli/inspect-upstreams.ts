import { UpstreamHub } from "../aggregator/upstream-hub.js";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";

export type DoctorInspectUpstream = {
  serverKey: string;
  ok: boolean;
  error?: string;
  toolCount?: number;
  toolNames?: string[];
};

export type DoctorInspectResult = {
  schemaVersion: 1;
  ok: boolean;
  /** Set when connect or overall deadline fails (not per-upstream list errors). */
  fatalError?: string;
  upstreams: DoctorInspectUpstream[];
};

export type RunDoctorInspectOptions = {
  /** Injected hub (e.g. tests); default is a new {@link UpstreamHub}. */
  hub?: UpstreamHub;
};

/**
 * Connect all stdio upstreams, run MCP `tools/list` per server (in parallel), then close.
 * Enforces an overall wall-clock timeout (best-effort: in-flight work may continue briefly).
 */
export async function runDoctorInspect(
  config: SennitConfig,
  timeoutMs: number,
  options?: RunDoctorInspectOptions,
): Promise<DoctorInspectResult> {
  const hub = options?.hub ?? new UpstreamHub();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const work = async (): Promise<DoctorInspectResult> => {
    await hub.connect(config);
    const upstreams: DoctorInspectUpstream[] = await Promise.all(
      hub.entries().map(async ([serverKey, client]) => {
        try {
          const { tools } = await client.listTools();
          const toolNames = tools.map((t) => t.name);
          return {
            serverKey,
            ok: true,
            toolCount: toolNames.length,
            toolNames,
          };
        } catch (e) {
          return { serverKey, ok: false, error: errorMessage(e) };
        }
      }),
    );
    const ok = upstreams.every((u) => u.ok);
    return { schemaVersion: 1, ok, upstreams };
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`inspect timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([work(), timeoutPromise]);
    return result;
  } catch (e) {
    const fatalError = errorMessage(e);
    return {
      schemaVersion: 1,
      ok: false,
      fatalError,
      upstreams: [],
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    await hub.close().catch(() => undefined);
  }
}
