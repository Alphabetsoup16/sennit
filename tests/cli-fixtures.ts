import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Built mock stdio MCP server (requires `npm run build`). */
export function distMockUpstreamPath(): string {
  return join(pkgRoot, "dist", "fixtures", "mock-upstream.js");
}

/** Write `data` as YAML in a temp dir; run `fn(absolutePath)`; always remove the dir. */
export async function withTempYamlConfig<T>(
  data: unknown,
  fn: (absolutePath: string) => T | Promise<T>,
): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "sennit-cli-yaml-"));
  const absolutePath = join(dir, "cfg.yaml");
  try {
    writeFileSync(absolutePath, YAML.stringify(data), "utf8");
    return await fn(absolutePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
