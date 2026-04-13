import { describe, expect, it } from "vitest";
import { wrapFetchWithDeadline } from "../src/lib/fetch-timeout.js";

describe("wrapFetchWithDeadline", () => {
  it("rejects when the inner fetch never resolves", async () => {
    const slow = (): Promise<Response> => new Promise(() => {});
    const wrapped = wrapFetchWithDeadline(30, slow as typeof fetch);
    await expect(wrapped("http://example.com")).rejects.toThrow(/timed out/);
  });

  it("passes through a fast response", async () => {
    const inner: typeof fetch = async () =>
      new Response("ok", { status: 200, statusText: "OK" });
    const wrapped = wrapFetchWithDeadline(5000, inner);
    const r = await wrapped("http://example.com");
    expect(r.status).toBe(200);
  });
});
