import { describe, expect, it } from "vitest";
import { formatScore, isValidScore, parseScore } from "./score";

describe("score", () => {
  it("parses decimals into tenths", () => {
    expect(parseScore("87.5")).toBe(875);
    expect(parseScore(100)).toBe(1000);
    expect(parseScore("0")).toBe(0);
  });

  it("rejects blank, non-numeric and out-of-range input", () => {
    expect(parseScore("")).toBeNull();
    expect(parseScore("  ")).toBeNull();
    expect(parseScore("abc")).toBeNull();
    expect(parseScore("100.1")).toBeNull();
    expect(parseScore(-1)).toBeNull();
  });

  it("formats tenths with one decimal", () => {
    expect(formatScore(875)).toBe("87.5");
    expect(formatScore(0)).toBe("0.0");
    expect(formatScore(1000)).toBe("100.0");
  });

  it("accepts only whole tenths from 0 to 1000", () => {
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(1000)).toBe(true);
    expect(isValidScore(1001)).toBe(false);
    expect(isValidScore(12.5)).toBe(false);
  });
});
