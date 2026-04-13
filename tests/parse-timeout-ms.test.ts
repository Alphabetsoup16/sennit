import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS,
  parsePositiveTimeoutMs,
  parseRequiredPositiveMs,
} from "../src/cli/parse-timeout-ms.js";

describe("parsePositiveTimeoutMs", () => {
  it("uses fallback for empty input", () => {
    expect(parsePositiveTimeoutMs(undefined, 99, "--timeout")).toBe(99);
    expect(parsePositiveTimeoutMs("", 99, "--timeout")).toBe(99);
  });

  it("parses positive integers", () => {
    expect(parsePositiveTimeoutMs("5000", 1, "--timeout")).toBe(5000);
    expect(parsePositiveTimeoutMs("1.9", 1, "--timeout")).toBe(1);
  });

  it("throws for invalid values", () => {
    expect(() => parsePositiveTimeoutMs("0", 1, "--timeout")).toThrow(/invalid --timeout/);
    expect(() => parsePositiveTimeoutMs("nan", 1, "--timeout")).toThrow(/invalid --timeout/);
  });

  it("exports default constant used by doctor inspect", () => {
    expect(DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS).toBe(30_000);
  });
});

describe("parseRequiredPositiveMs", () => {
  it("parses positive integers", () => {
    expect(parseRequiredPositiveMs("5000", "--timeout")).toBe(5000);
    expect(parseRequiredPositiveMs("1.9", "--timeout")).toBe(1);
  });

  it("throws for empty string", () => {
    expect(() => parseRequiredPositiveMs("", "--timeout")).toThrow(/empty/);
  });

  it("throws for invalid values", () => {
    expect(() => parseRequiredPositiveMs("0", "--timeout")).toThrow(/invalid --timeout/);
    expect(() => parseRequiredPositiveMs("nan", "--timeout")).toThrow(/invalid --timeout/);
  });
});
