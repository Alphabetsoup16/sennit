import { readFileSync } from "node:fs";
import { extname } from "node:path";
import YAML from "yaml";
import { sennitConfigSchema, type SennitConfig } from "./schema.js";

function parseRaw(raw: string, pathHint: string): unknown {
  const ext = extname(pathHint).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(raw);
  }
  if (ext === ".json") {
    return JSON.parse(raw) as unknown;
  }
  // Default: try YAML then JSON
  try {
    return YAML.parse(raw);
  } catch {
    return JSON.parse(raw) as unknown;
  }
}

/** Load and validate config from a file path. */
export function loadConfigFile(path: string): SennitConfig {
  const raw = readFileSync(path, "utf8");
  const data = parseRaw(raw, path);
  return sennitConfigSchema.parse(data);
}
