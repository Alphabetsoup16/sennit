import { describe, expect, it } from "vitest";
import {
  doctorInspectResultFromProbeRows,
  toolCatalogsFromProbeRowsOrThrow,
} from "../src/aggregator/upstream-probe.js";

describe("upstream-probe", () => {
  it("doctorInspectResultFromProbeRows matches per-upstream ok and errors", () => {
    const r = doctorInspectResultFromProbeRows([
      { serverKey: "a", ok: true, tools: [{ name: "t1" } as never], resourceCount: 2 },
      { serverKey: "b", ok: false, error: "boom" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.upstreams).toHaveLength(2);
    expect(r.upstreams[0]).toMatchObject({
      serverKey: "a",
      ok: true,
      toolCount: 1,
      toolNames: ["t1"],
      resourceCount: 2,
    });
    expect(r.upstreams[1]).toMatchObject({ serverKey: "b", ok: false, error: "boom" });
  });

  it("toolCatalogsFromProbeRowsOrThrow passes when all rows ok", () => {
    const catalogs = toolCatalogsFromProbeRowsOrThrow([
      { serverKey: "x", ok: true, tools: [{ name: "u" } as never] },
    ]);
    expect(catalogs).toEqual([{ serverKey: "x", tools: [{ name: "u" }] }]);
  });

  it("toolCatalogsFromProbeRowsOrThrow throws first error when any row failed", () => {
    expect(() =>
      toolCatalogsFromProbeRowsOrThrow([
        { serverKey: "x", ok: true, tools: [] },
        { serverKey: "y", ok: false, error: "list failed" },
      ]),
    ).toThrow("list failed");
  });
});
