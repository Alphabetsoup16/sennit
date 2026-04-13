import { describe, expect, it } from "vitest";
import { proxyToolInputSchema } from "../src/aggregator/proxy-input-schema.js";

describe("proxyToolInputSchema", () => {
  it("falls back to permissive record for non-object JSON Schema", () => {
    const s = proxyToolInputSchema({ type: "string" });
    expect(s.safeParse({ x: 1 }).success).toBe(true);
  });

  it("builds z.object from object properties and required", () => {
    const s = proxyToolInputSchema({
      type: "object",
      properties: {
        msg: { type: "string" },
        n: { type: "integer" },
        flag: { type: "boolean" },
      },
      required: ["msg"],
    });
    expect(s.safeParse({ msg: "hi" }).success).toBe(true);
    expect(s.safeParse({ msg: "hi", n: 1 }).success).toBe(true);
    expect(s.safeParse({ msg: "hi", n: 1.5 }).success).toBe(false);
    expect(s.safeParse({ n: 1 }).success).toBe(false);
  });

  it("treats properties not listed in required as optional", () => {
    const s = proxyToolInputSchema({
      type: "object",
      properties: { a: { type: "string" } },
      required: [],
    });
    expect(s.safeParse({}).success).toBe(true);
  });

  it("uses z.unknown() for unrecognized property types", () => {
    const s = proxyToolInputSchema({
      type: "object",
      properties: { blob: { type: "array" } },
      required: [],
    });
    expect(s.safeParse({ blob: [1, 2] }).success).toBe(true);
  });
});
