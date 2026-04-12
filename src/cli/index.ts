#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "../lib/version.js";
import { isMainModule } from "./main-module.js";
import { registerAllCommands } from "./register-commands.js";

const program = new Command();
program
  .name("sennit")
  .description("Sennit — MCP aggregator (mcp-parallel)")
  .version(VERSION);

registerAllCommands(program);

if (isMainModule(import.meta.url)) {
  void program.parseAsync(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { program };
