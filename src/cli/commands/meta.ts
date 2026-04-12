import type { Command } from "commander";
import { EMPTY_CONFIG } from "../load-config.js";
import { printJson } from "../print.js";

export function registerMeta(program: Command): void {
  program
    .command("meta")
    .description("Print empty config JSON (schema default, no upstreams)")
    .action(() => {
      printJson(EMPTY_CONFIG);
    });
}
