const SEP = "__";

/**
 * Join server key and upstream tool name. Server keys must not contain `__`
 * (reserved as delimiter).
 */
export function namespacedToolName(serverKey: string, toolName: string): string {
  if (serverKey.includes(SEP)) {
    throw new Error(`server key must not contain "${SEP}": ${JSON.stringify(serverKey)}`);
  }
  return `${serverKey}${SEP}${toolName}`;
}

/** Parse `serverKey__toolName` from a namespaced tool id. */
export function parseNamespaced(namespaced: string): { serverKey: string; toolName: string } {
  const i = namespaced.indexOf(SEP);
  if (i <= 0 || i === namespaced.length - SEP.length) {
    throw new Error(`invalid namespaced tool name: ${JSON.stringify(namespaced)}`);
  }
  return {
    serverKey: namespaced.slice(0, i),
    toolName: namespaced.slice(i + SEP.length),
  };
}
