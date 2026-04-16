import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

type OAuthClientCredentialsConfig = {
  type: "oauthClientCredentials";
  tokenUrl: string;
  clientId: string;
  clientSecretEnv: string;
  scope?: string;
  audience?: string;
  cacheKey?: string;
  minValidityMs?: number;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

function cacheFilePath(): string {
  return join(homedir(), ".sennit", "oauth-cache.json");
}

function readCache(): Record<string, CachedToken> {
  try {
    const raw = readFileSync(cacheFilePath(), "utf8");
    return JSON.parse(raw) as Record<string, CachedToken>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedToken>): void {
  const path = cacheFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache), "utf8");
}

function tokenCacheKey(serverKey: string, auth: OAuthClientCredentialsConfig): string {
  return auth.cacheKey ?? `${serverKey}:${auth.tokenUrl}:${auth.clientId}`;
}

function buildTokenBody(auth: OAuthClientCredentialsConfig, clientSecret: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", auth.clientId);
  body.set("client_secret", clientSecret);
  if (auth.scope) {
    body.set("scope", auth.scope);
  }
  if (auth.audience) {
    body.set("audience", auth.audience);
  }
  return body;
}

export function oauthClientCredentialsFetch(
  serverKey: string,
  auth: OAuthClientCredentialsConfig,
  baseFetch: typeof fetch,
  baseHeaders?: Record<string, string>,
  env: Record<string, string> = process.env as Record<string, string>,
): typeof fetch {
  let inMemory: CachedToken | undefined;
  const minValidityMs = auth.minValidityMs ?? 60_000;
  const cacheKey = tokenCacheKey(serverKey, auth);

  const getCached = (): CachedToken | undefined => {
    const now = Date.now();
    if (inMemory && inMemory.expiresAtMs - now > minValidityMs) {
      return inMemory;
    }
    const disk = readCache()[cacheKey];
    if (disk && disk.expiresAtMs - now > minValidityMs) {
      inMemory = disk;
      return disk;
    }
    return undefined;
  };

  const fetchToken = async (): Promise<CachedToken> => {
    const clientSecret = env[auth.clientSecretEnv];
    if (!clientSecret) {
      throw new Error(
        `missing OAuth client secret env ${JSON.stringify(auth.clientSecretEnv)} for ${JSON.stringify(serverKey)}`,
      );
    }
    const resp = await baseFetch(auth.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(baseHeaders ?? {}),
      },
      body: buildTokenBody(auth, clientSecret),
    });
    if (!resp.ok) {
      throw new Error(`oauth token request failed for ${JSON.stringify(serverKey)}: HTTP ${resp.status}`);
    }
    const json = (await resp.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof json.access_token !== "string" || json.access_token.length === 0) {
      throw new Error(`oauth token response missing access_token for ${JSON.stringify(serverKey)}`);
    }
    const expiresInSec = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
    const token: CachedToken = {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + expiresInSec * 1000,
    };
    inMemory = token;
    const cache = readCache();
    cache[cacheKey] = token;
    writeCache(cache);
    return token;
  };

  return async (input, init) => {
    let token = getCached();
    if (!token) {
      token = await fetchToken();
    }
    const headers = new Headers(init?.headers ?? {});
    if (baseHeaders) {
      for (const [k, v] of Object.entries(baseHeaders)) {
        if (!headers.has(k)) {
          headers.set(k, v);
        }
      }
    }
    headers.set("authorization", `Bearer ${token.accessToken}`);
    const first = await baseFetch(input, { ...init, headers });
    if (first.status !== 401) {
      return first;
    }
    token = await fetchToken();
    headers.set("authorization", `Bearer ${token.accessToken}`);
    return baseFetch(input, { ...init, headers });
  };
}
