import { describe, expect, it } from "vitest";
import { jsonText } from "../src/lib/json-text.js";

describe("jsonText", () => {
  it("formats with 2-space indent", () => {
    expect(jsonText({ a: 1 })).toBe("{\n  \"a\": 1\n}");
  });
});
