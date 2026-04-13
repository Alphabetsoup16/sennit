import type { Command } from "commander";
import { registerConfigPath } from "./commands/config-path.js";
import { registerConfigPrint } from "./commands/config-print.js";
import { registerConfigValidate } from "./commands/config-validate.js";
import { registerDoctor } from "./commands/doctor.js";
import { registerOnboard } from "./commands/onboard.js";
import { registerPlan } from "./commands/plan.js";
import { registerServe } from "./commands/serve.js";
import { registerSetup } from "./commands/setup.js";
import { registerVersion } from "./commands/version.js";

/**
 * Wire all CLI subcommands. To add a command: create `commands/<name>.ts` with
 * `register*(program)`, import it here, and call it below.
 */
export function registerAllCommands(program: Command): void {
  registerVersion(program);
  registerServe(program);
  registerPlan(program);
  registerDoctor(program);

  const config = program.command("config").description("Config helpers");
  registerConfigPath(config);
  registerConfigValidate(config);
  registerConfigPrint(config);

  registerSetup(program);
  registerOnboard(program);
}
