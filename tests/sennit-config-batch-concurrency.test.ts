import { describe, expect, it } from "vitest";
import { sennitConfigSchema } from "../src/config/schema.js";

describe("sennitConfigSchema batchCallMaxConcurrency", () => {
  it("rejects zero or negative values", () => {
    for (const batchCallMaxConcurrency of [0, -1]) {
      expect(() =>
        sennitConfigSchema.parse({
          version: 1,
          servers: {},
          batchCallMaxConcurrency,
        }),
      ).toThrow();
    }
  });
});
