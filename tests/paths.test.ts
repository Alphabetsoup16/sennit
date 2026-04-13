import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfigPath } from "../src/cli/paths.js";

describe("resolveConfigPath", () => {
  afterEach(() => {
    delete process.env.SENNIT_CONFIG;
  });

  it("returns explicit path unchanged", () => {
    expect(resolveConfigPath("/abs/cfg.yaml")).toBe("/abs/cfg.yaml");
  });

  it("prefers SENNIT_CONFIG when no explicit path", () => {
    process.env.SENNIT_CONFIG = "/from/env.yaml";
    expect(resolveConfigPath()).toBe("/from/env.yaml");
  });

  it("prefers cwd sennit.config.yaml over per-user file", () => {
    const prevCwd = process.cwd();
    const prevXdg = process.env.XDG_CONFIG_HOME;
    const root = mkdtempSync(join(tmpdir(), "sennit-path-"));
    try {
      process.chdir(root);
      process.env.XDG_CONFIG_HOME = join(root, "xdg");
      const userFile = join(process.env.XDG_CONFIG_HOME, "sennit", "config.yaml");
      mkdirSync(dirname(userFile), { recursive: true });
      writeFileSync(userFile, "version: 1\nservers: {}\n", "utf8");
      writeFileSync(join(root, "sennit.config.yaml"), "version: 1\nservers: {}\n", "utf8");
      const resolved = resolveConfigPath();
      expect(resolved).toBeDefined();
      expect(realpathSync(resolved!)).toBe(
        realpathSync(join(root, "sennit.config.yaml")),
      );
    } finally {
      process.chdir(prevCwd);
      if (prevXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = prevXdg;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses per-user config when cwd has no project file", () => {
    const prevCwd = process.cwd();
    const prevXdg = process.env.XDG_CONFIG_HOME;
    const root = mkdtempSync(join(tmpdir(), "sennit-path-user-"));
    try {
      process.chdir(root);
      process.env.XDG_CONFIG_HOME = join(root, "xdg");
      const userFile = join(process.env.XDG_CONFIG_HOME, "sennit", "config.yaml");
      mkdirSync(dirname(userFile), { recursive: true });
      writeFileSync(userFile, "version: 1\nservers: {}\n", "utf8");
      const resolved = resolveConfigPath();
      expect(resolved).toBeDefined();
      expect(realpathSync(resolved!)).toBe(realpathSync(userFile));
    } finally {
      process.chdir(prevCwd);
      if (prevXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = prevXdg;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
});
