import { jsonText } from "../lib/json-text.js";

export function printJson(value: unknown): void {
  process.stdout.write(`${jsonText(value)}\n`);
}

/** When `--json` is set, print one payload; otherwise run the human writer (stdout/stderr inside the callback). */
export function cliJsonOrHuman(opts: {
  json: boolean | undefined;
  jsonPayload: unknown;
  writeHuman: () => void;
}): void {
  if (opts.json) {
    printJson(opts.jsonPayload);
  } else {
    opts.writeHuman();
  }
}
