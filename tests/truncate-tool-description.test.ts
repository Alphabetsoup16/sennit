import { describe, expect, it } from "vitest";
import { truncateForToolList } from "../src/lib/truncate-tool-description.js";

describe("truncateForToolList", () => {
  it("returns text unchanged when max is undefined", () => {
    expect(truncateForToolList("hello world", undefined)).toBe("hello world");
  });

  it("returns text unchanged when under limit", () => {
    expect(truncateForToolList("hi", 10)).toBe("hi");
  });

  it("truncates with ellipsis when over limit", () => {
    expect(truncateForToolList("abcdefghij", 5)).toBe("abcd…");
  });
});
