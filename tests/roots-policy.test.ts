import { describe, expect, it } from "vitest";
import type { Root } from "@modelcontextprotocol/sdk/types.js";
import { applyRootsPolicy } from "../src/aggregator/roots-policy.js";
import type { RootsPolicy } from "../src/config/schema.js";

const roots = (uri: string): Root[] => [{ uri, name: "p" }];

describe("applyRootsPolicy", () => {
  it("ignore yields empty list", () => {
    const policy: RootsPolicy = { mode: "ignore" };
    expect(applyRootsPolicy(policy, roots("file:///a"))).toEqual([]);
  });

  it("forward copies host roots", () => {
    const policy: RootsPolicy = { mode: "forward" };
    const r = roots("file:///proj");
    expect(applyRootsPolicy(policy, r)).toEqual(r);
  });

  it("intersect filters by uri prefix", () => {
    const policy: RootsPolicy = {
      mode: "intersect",
      allowUriPrefixes: ["file:///allowed"],
    };
    const host: Root[] = [
      { uri: "file:///allowed/x", name: "ok" },
      { uri: "file:///other/y", name: "no" },
    ];
    expect(applyRootsPolicy(policy, host)).toEqual([{ uri: "file:///allowed/x", name: "ok" }]);
  });
});
