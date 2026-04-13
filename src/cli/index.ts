#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "../lib/version.js";
import { isMainModule } from "./main-module.js";
import { registerAllCommands } from "./register-commands.js";

const program = new Command();
program
  .name("sennit")
  .description("Sennit — MCP aggregator")
  .version(VERSION)
  /** So `doctor inspect -c path` binds `-c` to `inspect`, not the root program. */
  .enablePositionalOptions();

registerAllCommands(program);

program.helpCommand(
  "help [command]",
  "Show help for sennit or one subcommand (e.g. sennit help doctor)",
);

if (isMainModule(import.meta.url)) {
  void program.parseAsync(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { program };
