import { describe, expect, it } from "vitest";
import {
  namespacedToolName,
  parseNamespaced,
  takeUniqueMergedToolId,
} from "../src/lib/namespace.js";

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

  it("parseNamespaced rejects missing delimiter", () => {
    expect(() => parseNamespaced("noDelimiterHere")).toThrow(/invalid namespaced/);
  });

  it("parseNamespaced rejects delimiter at start", () => {
    expect(() => parseNamespaced("__toolOnly")).toThrow(/invalid namespaced/);
  });

  it("parseNamespaced rejects empty tool segment", () => {
    expect(() => parseNamespaced("server__")).toThrow(/invalid namespaced/);
  });

  it("parseNamespaced rejects empty server segment", () => {
    expect(() => parseNamespaced("__tool")).toThrow(/invalid namespaced/);
  });

  it("takeUniqueMergedToolId rejects duplicate merged ids", () => {
    const seen = new Set<string>();
    expect(takeUniqueMergedToolId(seen, "a", "t")).toBe("a__t");
    expect(() => takeUniqueMergedToolId(seen, "a", "t")).toThrow(/duplicate namespaced tool/);
  });
});
