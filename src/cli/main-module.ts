import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * True when `entry` is the file Node executed (e.g. `dist/cli/index.js`).
 * Pass `import.meta.url` from the CLI entry file.
 */
export function isMainModule(entry: string | URL): boolean {
  const thisFile = fileURLToPath(entry);
  const invokedAs = process.argv[1] ? resolve(process.argv[1]) : "";
  return invokedAs === thisFile;
}
