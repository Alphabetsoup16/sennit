import type { Root } from "@modelcontextprotocol/sdk/types.js";
import type { RootsPolicy } from "../config/schema.js";

/** Apply Sennit `roots` policy to roots returned from the host MCP client. */
export function applyRootsPolicy(policy: RootsPolicy, hostRoots: Root[]): Root[] {
  switch (policy.mode) {
    case "ignore":
      return [];
    case "forward":
      return [...hostRoots];
    case "intersect": {
      const prefixes = policy.allowUriPrefixes ?? [];
      return hostRoots.filter((r) => prefixes.some((p) => r.uri.startsWith(p)));
    }
  }
}

/**
 * After {@link applyRootsPolicy}, rewrite URIs for the upstream that issued `roots/list`.
 * Longest matching `fromPrefix` per server wins.
 */
export function applyUpstreamRootRewrites(
  serverKey: string,
  policy: RootsPolicy,
  roots: Root[],
): Root[] {
  const rules = policy.mapByUpstream?.[serverKey];
  if (!rules || rules.length === 0) {
    return roots;
  }
  const sorted = [...rules].sort((a, b) => b.fromPrefix.length - a.fromPrefix.length);
  return roots.map((r) => {
    for (const rule of sorted) {
      if (r.uri.startsWith(rule.fromPrefix)) {
        return {
          ...r,
          uri: rule.toPrefix + r.uri.slice(rule.fromPrefix.length),
        };
      }
    }
    return r;
  });
}
