import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { defaultUserSennitConfigFile } from "../src/cli/user-sennit-paths.js";

describe("defaultUserSennitConfigFile", () => {
  const prevXdg = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (prevXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = prevXdg;
    }
  });

  it("uses XDG_CONFIG_HOME/sennit/config.yaml when set", () => {
    process.env.XDG_CONFIG_HOME = "/tmp/xdg-sennit-test";
    expect(defaultUserSennitConfigFile()).toBe(
      join("/tmp/xdg-sennit-test", "sennit", "config.yaml"),
    );
  });
});
