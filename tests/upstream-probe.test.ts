import { describe, expect, it, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  doctorInspectResultFromProbeRows,
  probeConnectedHub,
  toolCatalogsFromProbeRowsOrThrow,
} from "../src/aggregator/upstream-probe.js";
import type { UpstreamHub } from "../src/aggregator/upstream-hub.js";

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

  it("probeConnectedHub skips listResources when server omits resources capability", async () => {
    const listResources = vi.fn();
    const listResourceTemplates = vi.fn();
    const client = {
      listTools: vi.fn(async () => ({ tools: [{ name: "t" } as never] })),
      getServerCapabilities: () => ({ tools: {} }),
      listResources,
      listResourceTemplates,
    } as unknown as Client;
    const hub: Pick<UpstreamHub, "configuredServerKeys" | "ensureClient"> = {
      configuredServerKeys: () => ["onlyTools"],
      ensureClient: vi.fn(async () => client),
    };
    const rows = await probeConnectedHub(hub as UpstreamHub);
    expect(listResources).not.toHaveBeenCalled();
    expect(listResourceTemplates).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({
      serverKey: "onlyTools",
      ok: true,
      resourceCount: undefined,
      resourceTemplateCount: undefined,
    });
  });
});
