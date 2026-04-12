/** First `text` block from `client.callTool` (narrowed at runtime). */
export function firstTextBlock(result: unknown): string {
  if (
    typeof result !== "object" ||
    result === null ||
    !("content" in result) ||
    !Array.isArray((result as { content: unknown }).content)
  ) {
    throw new Error(`invalid tool result: ${JSON.stringify(result)}`);
  }
  const content = (result as { content: Array<{ type?: string; text?: string }> })
    .content;
  const block = content[0];
  if (!block || block.type !== "text" || typeof block.text !== "string") {
    throw new Error(`expected text content block, got ${JSON.stringify(block)}`);
  }
  return block.text;
}
