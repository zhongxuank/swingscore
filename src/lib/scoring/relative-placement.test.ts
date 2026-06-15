import { describe, expect, it } from "vitest";
import { calculateRelativePlacements, convertRawScoresToOrdinals } from "@/lib/scoring/relative-placement";
import type { RawScore } from "@/lib/types";

function sheet(judgeId: string, values: Record<string, number>) {
  const scores: RawScore[] = Object.entries(values).map(([subjectId, scoreX2]) => ({
    judgeId,
    subjectId,
    scoreX2
  }));
  return convertRawScoresToOrdinals(scores);
}

describe("relative placement", () => {
  it("places the couple with majority first", () => {
    const result = calculateRelativePlacements(["A", "B", "C"], [
      sheet("J1", { A: 200, B: 190, C: 180 }),
      sheet("J2", { A: 198, C: 190, B: 180 }),
      sheet("J3", { B: 200, A: 190, C: 180 })
    ]);

    expect(result.placements[0]).toMatchObject({ coupleId: "A", placement: 1 });
  });

  it("uses ordinal sums to resolve same-level majorities", () => {
    const result = calculateRelativePlacements(["A", "B", "C"], [
      sheet("J1", { A: 200, B: 190, C: 180 }),
      sheet("J2", { B: 200, A: 190, C: 180 }),
      sheet("J3", { A: 200, B: 190, C: 180 })
    ]);

    expect(result.placements.map((row) => row.coupleId)).toEqual(["A", "B", "C"]);
  });
});
