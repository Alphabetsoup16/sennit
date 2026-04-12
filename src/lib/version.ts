import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, "..", "..");
  const raw = readFileSync(join(root, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version: string };
  return pkg.version;
}

/** Package version from root `package.json` (works from `src/` or `dist/`). */
export const VERSION = readPackageVersion();
