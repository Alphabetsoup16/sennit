import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Built CLI entry (requires `pretest` / `npm run build`). */
export const SENNIT_CLI = join(pkgRoot, "dist", "cli", "index.js");

export type RunCliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/** Run `node dist/cli/index.js …args` and capture stdout/stderr (UTF-8). */
export function runCli(
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; cwd?: string },
): RunCliResult {
  const r = spawnSync(process.execPath, [SENNIT_CLI, ...args], {
    encoding: "utf8",
    cwd: options?.cwd ?? pkgRoot,
    env: { ...process.env, ...options?.env },
  });
  return {
    code: r.status ?? (r.error ? 1 : 0),
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}
