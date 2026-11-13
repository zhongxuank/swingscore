import { describe, expect, it } from "vitest";
import { deriveMarks } from "./callback";

describe("deriveMarks", () => {
  const sheet = { A: 950, B: 900, C: 870, D: 860, E: 850, F: 700 };

  it("marks the top entries Yes, the next Alternates and the rest No", () => {
    const { marks, ties } = deriveMarks(sheet, 2, 2);
    expect(marks.map((m) => [m.entryId, m.status, m.altLevel, m.points])).toEqual([
      ["A", "yes", undefined, 10],
      ["B", "yes", undefined, 10],
      ["C", "alt", 1, 4.5],
      ["D", "alt", 2, 4.3],
      ["E", "no", undefined, 0],
      ["F", "no", undefined, 0]
    ]);
    expect(ties).toEqual([]);
  });

  it("gives alternates beyond the third the third alternate's points", () => {
    const { marks } = deriveMarks({ A: 900, B: 890, C: 880, D: 870, E: 860 }, 0, 5);
    expect(marks.map((m) => m.points)).toEqual([4.5, 4.3, 4.2, 4.2, 4.2]);
  });

  it("flags equal scores that straddle the Yes and Alternate boundary", () => {
    const { ties } = deriveMarks({ A: 950, B: 900, C: 900, D: 800 }, 2, 1);
    expect(ties).toEqual([{ entryIds: ["B", "C"], score: 900 }]);
  });

  it("flags equal scores that straddle the Alternate and No boundary", () => {
    const { ties } = deriveMarks({ A: 950, B: 900, C: 900, D: 800 }, 1, 1);
    expect(ties).toEqual([{ entryIds: ["B", "C"], score: 900 }]);
  });

  it("ignores equal scores that earn the same points", () => {
    expect(deriveMarks({ A: 950, B: 900, C: 900, D: 800 }, 3, 0).ties).toEqual([]);
    expect(deriveMarks({ A: 950, B: 800, C: 800, D: 800 }, 1, 0).ties).toEqual([]);
  });

  it("flags equal scores across different alternate levels", () => {
    const { ties } = deriveMarks({ A: 950, B: 900, C: 900 }, 1, 2);
    expect(ties).toEqual([{ entryIds: ["B", "C"], score: 900 }]);
  });
});
