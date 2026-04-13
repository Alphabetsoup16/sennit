import { errorMessage } from "../lib/error-message.js";
import {
  DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS,
  parsePositiveTimeoutMs,
  parseRequiredPositiveMs,
} from "./parse-timeout-ms.js";

export type TimeoutParseResult =
  | { ok: true; ms: number }
  | { ok: false; message: string };

/** `plan --timeout`: empty uses default wall-clock budget for connect+probe. */
export function tryParsePlanInspectTimeout(raw: string | undefined): TimeoutParseResult {
  try {
    const ms = parsePositiveTimeoutMs(
      raw,
      DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS,
      "--timeout",
    );
    return { ok: true, ms };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

/** `doctor inspect --timeout`: must be a positive integer. */
export function tryParseDoctorInspectTimeout(raw: string): TimeoutParseResult {
  try {
    const ms = parseRequiredPositiveMs(raw, "--timeout");
    return { ok: true, ms };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}
