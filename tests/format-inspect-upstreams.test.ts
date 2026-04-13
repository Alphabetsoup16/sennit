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

  it("renders resource template counts when present", () => {
    const lines = formatInspectUpstreamsHumanLines([
      {
        serverKey: "a",
        ok: true,
        toolCount: 1,
        toolNames: ["t1"],
        resourceCount: 1,
        resourceTemplateCount: 2,
      },
    ]);
    expect(lines.some((l) => l.includes("1 resources; 2 resource templates"))).toBe(true);
  });

  it("renders template-only counts when static resource count is absent", () => {
    const lines = formatInspectUpstreamsHumanLines([
      {
        serverKey: "a",
        ok: true,
        toolCount: 0,
        toolNames: [],
        resourceTemplateCount: 3,
      },
    ]);
    expect(lines.some((l) => l.includes("; 3 resource templates"))).toBe(true);
  });
});
