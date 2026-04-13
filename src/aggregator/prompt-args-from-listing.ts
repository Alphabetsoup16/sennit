import type { Prompt } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Build a Zod object shape from `prompts/list` metadata so {@link McpServer.registerPrompt}
 * can validate `prompts/get` arguments before proxying upstream.
 */
export function zodShapeFromPromptArguments(prompt: Prompt): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const a of prompt.arguments ?? []) {
    let field: z.ZodTypeAny = z.string();
    if (!a.required) {
      field = field.optional();
    }
    shape[a.name] = field;
  }
  return shape;
}
