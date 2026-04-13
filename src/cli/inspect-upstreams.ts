import type { DoctorInspectResult } from "../aggregator/doctor-inspect-types.js";
import { doctorInspectResultFromProbeRows, probeConnectedHub } from "../aggregator/upstream-probe.js";
import { UpstreamHub } from "../aggregator/upstream-hub.js";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";

export type { DoctorInspectResult, DoctorInspectUpstream } from "../aggregator/doctor-inspect-types.js";

export type RunDoctorInspectOptions = {
  /** Injected hub (e.g. tests); default is a new {@link UpstreamHub}. */
  hub?: UpstreamHub;
};

/**
 * Connect all stdio upstreams, run MCP `tools/list` per server (in parallel), then close.
 * Best-effort `resources/list` per upstream (ignored when unsupported).
 * Enforces an overall wall-clock timeout. Further upstream spawns are aborted once the deadline
 * passes; a single in-flight `client.connect` may still run until `hub.close()` in `finally`.
 */
export async function runDoctorInspect(
  config: SennitConfig,
  timeoutMs: number,
  options?: RunDoctorInspectOptions,
): Promise<DoctorInspectResult> {
  const hub = options?.hub ?? new UpstreamHub();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const ac = new AbortController();

  const work = async () => {
    await hub.connect(config, { signal: ac.signal });
    const rows = await probeConnectedHub(hub);
    return doctorInspectResultFromProbeRows(rows);
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      ac.abort();
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
