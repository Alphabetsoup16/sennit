import type { Command } from "commander";
import { z } from "zod";
import { sennitConfigSchema } from "../../config/schema.js";
import { printJson } from "../print.js";

export function registerConfigSchema(parent: Command): void {
  parent
    .command("schema")
    .description(
      "Print JSON Schema for config files (Zod input shape, draft-7). Default: schema only on stdout for editor integration.",
    )
    .option(
      "--wrap",
      "Wrap as { schemaVersion: 1, jsonSchema } (consistent with other --json payloads)",
    )
    .action((opts: { wrap?: boolean }) => {
      const jsonSchema = z.toJSONSchema(sennitConfigSchema, { target: "draft-7", io: "input" });
      if (opts.wrap) {
        printJson({ schemaVersion: 1, jsonSchema });
      } else {
        process.stdout.write(`${JSON.stringify(jsonSchema, null, 2)}\n`);
      }
    });
}
