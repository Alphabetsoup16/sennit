import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./run-cli.js";

describe("CLI setup", () => {
  it("writes template to -o path", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-setup-cli-"));
    const out = join(dir, "cfg.yaml");
    try {
      const { code, stdout, stderr } = runCli(["setup", "-o", out]);
      expect(code).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toMatch(/Wrote/);
      const body = readFileSync(out, "utf8");
      expect(body).toMatch(/version:\s*1/);
      expect(body).toMatch(/servers:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
