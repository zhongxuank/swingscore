import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashAccessToken, newAccessToken } from "./access-token";

describe("access tokens", () => {
  it("are 43 URL-safe characters and never repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, newAccessToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hash to the same SHA-256 hex the database computes", async () => {
    const token = newAccessToken();
    expect(await hashAccessToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
  });
});
