import { describe, expect, it } from "vitest";
import {
  tryParseDoctorInspectTimeout,
  tryParsePlanInspectTimeout,
} from "../src/cli/cli-timeout.js";
import { DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS } from "../src/cli/parse-timeout-ms.js";

describe("cli-timeout", () => {
  it("tryParsePlanInspectTimeout uses default when raw is undefined", () => {
    const r = tryParsePlanInspectTimeout(undefined);
    expect(r).toEqual({ ok: true, ms: DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS });
  });

  it("tryParsePlanInspectTimeout rejects invalid values", () => {
    const r = tryParsePlanInspectTimeout("0");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/invalid/i);
  });

  it("tryParseDoctorInspectTimeout accepts positive ms", () => {
    expect(tryParseDoctorInspectTimeout("5000")).toEqual({ ok: true, ms: 5000 });
  });

  it("tryParseDoctorInspectTimeout rejects empty", () => {
    const r = tryParseDoctorInspectTimeout("");
    expect(r.ok).toBe(false);
  });
});
