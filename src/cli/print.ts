import { jsonText } from "../lib/json-text.js";

export function printJson(value: unknown): void {
  process.stdout.write(`${jsonText(value)}\n`);
}
