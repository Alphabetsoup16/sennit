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
