import { describe, expect, it } from "vitest";
import { assertHttpOrHttpsUrl } from "../src/lib/assert-http-upstream-url.js";

describe("assertHttpOrHttpsUrl", () => {
  it("accepts http and https URLs", () => {
    expect(assertHttpOrHttpsUrl("http://127.0.0.1:9/mcp", "test").href).toBe("http://127.0.0.1:9/mcp");
    expect(assertHttpOrHttpsUrl("https://example.com/x", "test").href).toBe("https://example.com/x");
  });

  it("rejects non-http(s) schemes", () => {
    for (const url of [
      "file:///tmp/x",
      "data:text/plain,hi",
      "javascript:alert(1)",
      "ftp://example.com/",
    ]) {
      expect(() => assertHttpOrHttpsUrl(url, "ctx")).toThrow(/http or https/);
    }
  });
});
