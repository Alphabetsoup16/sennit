import { describe, expect, it } from "vitest";
import { errorMessage } from "../src/lib/error-message.js";

describe("errorMessage", () => {
  it("returns message for Error", () => {
    expect(errorMessage(new Error("x"))).toBe("x");
  });

  it("stringifies non-errors", () => {
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage(42)).toBe("42");
  });
});
