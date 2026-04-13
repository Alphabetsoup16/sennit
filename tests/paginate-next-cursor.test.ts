import { describe, expect, it } from "vitest";
import { paginateByNextCursor } from "../src/lib/paginate-next-cursor.js";

describe("paginateByNextCursor", () => {
  it("returns empty when the first page has no items and no cursor", async () => {
    const r = await paginateByNextCursor(async () => ({ items: [], nextCursor: undefined }));
    expect(r).toEqual([]);
  });

  it("concatenates pages until nextCursor is absent", async () => {
    let calls = 0;
    const r = await paginateByNextCursor(async (c) => {
      calls++;
      if (c === undefined) {
        return { items: [1, 2], nextCursor: "b" };
      }
      if (c === "b") {
        return { items: [3], nextCursor: undefined };
      }
      return { items: [], nextCursor: undefined };
    });
    expect(r).toEqual([1, 2, 3]);
    expect(calls).toBe(2);
  });
});
