import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { oauthClientCredentialsFetch } from "../src/lib/oauth-client-credentials.js";

describe("oauthClientCredentialsFetch", () => {
  it("fetches token and injects bearer header", async () => {
    const oldHome = process.env.HOME;
    const home = mkdtempSync(join(tmpdir(), "sennit-oauth-"));
    process.env.HOME = home;
    process.env.CLIENT_SECRET = "secret";

    const baseFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok1", expires_in: 300 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    try {
      const wrapped = oauthClientCredentialsFetch(
        "alpha",
        {
          type: "oauthClientCredentials",
          tokenUrl: "https://auth.example.com/token",
          clientId: "id",
          clientSecretEnv: "CLIENT_SECRET",
        },
        baseFetch,
      );
      await wrapped("https://api.example.com/mcp");

      expect(baseFetch).toHaveBeenCalledTimes(2);
      const secondInit = baseFetch.mock.calls[1]?.[1];
      const headers = new Headers(secondInit?.headers);
      expect(headers.get("authorization")).toBe("Bearer tok1");
    } finally {
      if (oldHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = oldHome;
      }
      delete process.env.CLIENT_SECRET;
      rmSync(home, { recursive: true, force: true });
    }
  });
});
