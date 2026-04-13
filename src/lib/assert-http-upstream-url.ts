/** Reject non-http(s) URLs for remote MCP upstreams (defense in depth). */
export function assertHttpOrHttpsUrl(urlString: string, context: string): URL {
  const u = new URL(urlString);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`${context}: URL must use http or https, got ${JSON.stringify(u.protocol)}`);
  }
  return u;
}
