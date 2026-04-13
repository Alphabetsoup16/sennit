import { describe, expect, it } from "vitest";
import { facadeResourceUri, parseFacadeResourceUri } from "../src/lib/resource-facade.js";

describe("resource facade URIs", () => {
  it("round-trips server key and upstream URI", () => {
    const serverKey = "my-upstream";
    const upstream = "file:///tmp/a b/c.md";
    const facade = facadeResourceUri(serverKey, upstream);
    expect(facade.startsWith("urn:sennit:resource:v1:")).toBe(true);
    const parsed = parseFacadeResourceUri(facade);
    expect(parsed).toEqual({ serverKey, upstreamUri: upstream });
  });

  it("returns null for foreign URIs", () => {
    expect(parseFacadeResourceUri("https://example.com/x")).toBeNull();
  });
});
