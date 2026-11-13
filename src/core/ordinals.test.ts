import { describe, expect, it } from "vitest";
import { toOrdinals } from "./ordinals";

describe("toOrdinals", () => {
  it("ranks the highest score as 1", () => {
    expect(toOrdinals({ A: 900, B: 950, C: 870 })).toEqual({ ok: true, ordinals: { B: 1, A: 2, C: 3 } });
  });

  it("reports equal scores instead of breaking them by id", () => {
    expect(toOrdinals({ A: 900, B: 900, C: 870 })).toEqual({
      ok: false,
      duplicates: [{ score: 900, entryIds: ["A", "B"] }]
    });
  });

  it("throws on a score that is not a whole number of tenths from 0 to 1000", () => {
    expect(() => toOrdinals({ A: 1001 })).toThrow(RangeError);
    expect(() => toOrdinals({ A: 12.5 })).toThrow(RangeError);
  });
});
