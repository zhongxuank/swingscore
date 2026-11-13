import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/contests/abc")).toBe("/contests/abc");
  });

  it("falls back for missing, external or protocol-relative targets", () => {
    expect(safeNextPath(null)).toBe("/contests");
    expect(safeNextPath("https://evil.example")).toBe("/contests");
    expect(safeNextPath("//evil.example")).toBe("/contests");
    expect(safeNextPath("/\\evil.example")).toBe("/contests");
  });
});
