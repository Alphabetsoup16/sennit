import type { Command } from "commander";
import { VERSION } from "../../lib/version.js";
import { cliJsonOrHuman } from "../print.js";

export function registerVersion(program: Command): void {
  program
    .command("version")
    .description("Print Sennit and Node versions (use --json for scripts)")
    .option("--json", "Machine-readable output")
    .action((opts: { json?: boolean }) => {
      cliJsonOrHuman({
        json: opts.json,
        jsonPayload: {
          schemaVersion: 1,
          name: "sennit",
          displayName: "Sennit",
          version: VERSION,
          node: process.version,
        },
        writeHuman: () => {
          process.stdout.write(`Sennit ${VERSION}\n`);
          process.stdout.write(`node ${process.version}\n`);
        },
      });
    });
}
