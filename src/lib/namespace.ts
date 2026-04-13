/** Reserved delimiter between upstream key and tool name in proxied tool ids. */
export const TOOL_NAMESPACE_SEPARATOR = "__" as const;

/**
 * Join server key and upstream tool name. Server keys must not contain {@link TOOL_NAMESPACE_SEPARATOR}
 * (reserved as delimiter).
 */
export function namespacedToolName(serverKey: string, toolName: string): string {
  if (serverKey.includes(TOOL_NAMESPACE_SEPARATOR)) {
    throw new Error(
      `server key must not contain "${TOOL_NAMESPACE_SEPARATOR}": ${JSON.stringify(serverKey)}`,
    );
  }
  return `${serverKey}${TOOL_NAMESPACE_SEPARATOR}${toolName}`;
}

/** Parse `serverKey__toolName` from a namespaced tool id. */
export function parseNamespaced(namespaced: string): { serverKey: string; toolName: string } {
  const SEP = TOOL_NAMESPACE_SEPARATOR;
  const i = namespaced.indexOf(SEP);
  if (i <= 0 || i === namespaced.length - SEP.length) {
    throw new Error(`invalid namespaced tool name: ${JSON.stringify(namespaced)}`);
  }
  return {
    serverKey: namespaced.slice(0, i),
    toolName: namespaced.slice(i + TOOL_NAMESPACE_SEPARATOR.length),
  };
}

/**
 * Reserves a merged host-facing tool id for `serverKey` + `toolName`.
 * @throws if the same namespaced id was already taken (upstream duplicate tool names).
 */
export function takeUniqueMergedToolId(
  seen: Set<string>,
  serverKey: string,
  toolName: string,
): string {
  const full = namespacedToolName(serverKey, toolName);
  if (seen.has(full)) {
    throw new Error(`duplicate namespaced tool after merge: ${full}`);
  }
  seen.add(full);
  return full;
}
