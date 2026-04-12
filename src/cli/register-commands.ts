import type { Command } from "commander";
import { registerConfigValidate } from "./commands/config-validate.js";
import { registerDoctor } from "./commands/doctor.js";
import { registerMeta } from "./commands/meta.js";
import { registerOnboard } from "./commands/onboard.js";
import { registerServe } from "./commands/serve.js";

/**
 * Wire all CLI subcommands. To add a command: create `commands/<name>.ts` with
 * `register*(program)`, import it here, and call it below.
 */
export function registerAllCommands(program: Command): void {
  registerServe(program);
  registerDoctor(program);

  const config = program.command("config").description("Config helpers");
  registerConfigValidate(config);

  registerOnboard(program);
  registerMeta(program);
}
