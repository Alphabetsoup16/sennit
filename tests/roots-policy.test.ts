import { describe, expect, it } from "vitest";
import type { Root } from "@modelcontextprotocol/sdk/types.js";
import { applyRootsPolicy, applyUpstreamRootRewrites } from "../src/aggregator/roots-policy.js";
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

describe("applyUpstreamRootRewrites", () => {
  it("rewrites longest matching prefix for the server key", () => {
    const policy: RootsPolicy = {
      mode: "forward",
      mapByUpstream: {
        alpha: [
          { fromPrefix: "file:///a", toPrefix: "file:///b" },
          { fromPrefix: "file:///a/long", toPrefix: "file:///c" },
        ],
      },
    };
    const inRoots: Root[] = [{ uri: "file:///a/long/x", name: "p" }];
    expect(applyUpstreamRootRewrites("alpha", policy, inRoots)).toEqual([
      { uri: "file:///c/x", name: "p" },
    ]);
  });

  it("leaves roots unchanged when no rules for server", () => {
    const policy: RootsPolicy = {
      mode: "forward",
      mapByUpstream: { other: [{ fromPrefix: "file:///x", toPrefix: "file:///y" }] },
    };
    const inRoots: Root[] = [{ uri: "file:///x/z", name: "p" }];
    expect(applyUpstreamRootRewrites("alpha", policy, inRoots)).toEqual(inRoots);
  });
});
