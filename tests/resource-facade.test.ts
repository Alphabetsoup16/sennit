import { describe, expect, it } from "vitest";
import {
  FACADE_RESOURCE_TEMPLATE_URI_VARIABLE,
  facadeResourceTemplatePattern,
  facadeResourceUri,
  parseFacadeResourceUri,
} from "../src/lib/resource-facade.js";

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

  it("builds a stable façade template pattern with {+u} for the upstream URI", () => {
    const serverKey = "alpha";
    const upstreamTpl = "file:///repo/{path}";
    const pattern = facadeResourceTemplatePattern(serverKey, upstreamTpl);
    expect(pattern.startsWith("urn:sennit:rt:v1:")).toBe(true);
    const tplSuffix = `/{+${FACADE_RESOURCE_TEMPLATE_URI_VARIABLE}}`;
    expect(pattern.endsWith(tplSuffix)).toBe(true);
    const withoutSuffix = pattern.slice(0, -tplSuffix.length);
    const b64 = withoutSuffix.slice("urn:sennit:rt:v1:".length);
    const decoded = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as {
      k: string;
      t: string;
    };
    expect(decoded).toEqual({ k: serverKey, t: upstreamTpl });
  });
});
