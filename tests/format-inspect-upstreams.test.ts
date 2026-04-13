import { describe, expect, it } from "vitest";
import { formatInspectUpstreamsHumanLines } from "../src/cli/format-inspect-upstreams.js";

describe("formatInspectUpstreamsHumanLines", () => {
  it("includes fatal line and skips empty-upstream hint when fatal is set", () => {
    const lines = formatInspectUpstreamsHumanLines([], { fatalError: "timed out" });
    expect(lines).toEqual(["  fatal: timed out"]);
  });

  it("renders ok rows with optional resource counts", () => {
    const lines = formatInspectUpstreamsHumanLines([
      {
        serverKey: "a",
        ok: true,
        toolCount: 2,
        toolNames: ["t1", "t2"],
        resourceCount: 3,
      },
    ]);
    expect(lines.some((l) => l.includes("2 tools; 3 resources"))).toBe(true);
  });
});
