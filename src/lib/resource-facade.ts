import { Buffer } from "node:buffer";

const PREFIX = "urn:sennit:resource:v1:";

type Payload = { k: string; u: string };

function encodePayload(p: Payload): string {
  return PREFIX + Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

function decodePayload(s: string): Payload | null {
  if (!s.startsWith(PREFIX)) {
    return null;
  }
  const b64 = s.slice(PREFIX.length);
  try {
    const raw = Buffer.from(b64, "base64url").toString("utf8");
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === "object" &&
      v !== null &&
      "k" in v &&
      "u" in v &&
      typeof (v as Payload).k === "string" &&
      typeof (v as Payload).u === "string"
    ) {
      return v as Payload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Host-facing resource URI for an upstream static resource (opaque to callers). */
export function facadeResourceUri(serverKey: string, upstreamUri: string): string {
  return encodePayload({ k: serverKey, u: upstreamUri });
}

export function parseFacadeResourceUri(facadeUri: string): { serverKey: string; upstreamUri: string } | null {
  const p = decodePayload(facadeUri);
  return p ? { serverKey: p.k, upstreamUri: p.u } : null;
}
