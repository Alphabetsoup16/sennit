import type { Command } from "commander";
import { writeDefaultUserConfigPathToStdout } from "../user-sennit-paths.js";

export function registerConfigPath(parent: Command): void {
  parent
    .command("path")
    .description("Print default per-user config file path (one line, for scripts and onboarding)")
    .action(() => {
      writeDefaultUserConfigPathToStdout();
    });
}
