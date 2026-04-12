import { describe, expect, it } from "vitest";
import { namespacedToolName, parseNamespaced } from "../src/lib/namespace.js";

describe("namespace", () => {
  it("joins and splits", () => {
    const n = namespacedToolName("ctx7", "get_library_docs");
    expect(n).toBe("ctx7__get_library_docs");
    expect(parseNamespaced(n)).toEqual({
      serverKey: "ctx7",
      toolName: "get_library_docs",
    });
  });

  it("rejects __ in server key", () => {
    expect(() => namespacedToolName("bad__key", "t")).toThrow(/server key/);
  });
});
