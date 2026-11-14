import { describe, expect, it } from "vitest";
import type { FinalCouple, RoundJudge } from "@/data/types";
import { finalPlacements, tallyFinal } from "./final-results";

const couples: FinalCouple[] = ["a", "b", "c"].map((id, i) => ({ id, roundId: "f", number: i + 1, leaderId: `l${id}`, followerId: `f${id}` }));
const judge = (id: string, isChief = false): RoundJudge => ({ id, roundId: "f", name: id.toUpperCase(), assignment: "both", isChief });
const judges = [judge("j1"), judge("j2"), judge("j3"), judge("cj", true)];
const sheet = (judgeId: string, a: number, b: number, c: number) => [
  { judgeId, coupleId: "a", tenths: a },
  { judgeId, coupleId: "b", tenths: b },
  { judgeId, coupleId: "c", tenths: c }
];
const allIn = judges.map((j) => ({ judgeId: j.id, role: null, submittedAt: "" }));

describe("final tally", () => {
  it("waits for counted judges only, and needs an odd counted panel", () => {
    expect(tallyFinal(couples, judges, [], [], false).waiting).toEqual(["J1", "J2", "J3"]);
    expect(tallyFinal(couples, judges, allIn, [], true).problems).toEqual(["The counted panel must be an odd number of judges. It has 4."]);
  });

  it("places couples by Relative Placement and ignores the chief judge when not counted", () => {
    const scores = [...sheet("j1", 900, 800, 700), ...sheet("j2", 800, 900, 700), ...sheet("j3", 900, 700, 800), ...sheet("cj", 100, 200, 300)];
    const tally = tallyFinal(couples, judges, allIn, scores, false);
    expect(tally.problems).toEqual([]);
    expect(finalPlacements(tally.result!, {})).toEqual([
      { coupleId: "a", place: 1 },
      { coupleId: "b", place: 2 },
      { coupleId: "c", place: 3 }
    ]);
  });

  it("needs the organiser's order for an unresolved tie", () => {
    const result = { placements: [{ entryId: "a", place: 1, tied: true }, { entryId: "b", place: 1, tied: true }], unresolved: [{ places: [1, 2] as [number, number], entryIds: ["a", "b"] }] };
    expect(finalPlacements(result, {})).toBeNull();
    expect(finalPlacements(result, { 1: ["b", "a"] })).toEqual([
      { coupleId: "b", place: 1 },
      { coupleId: "a", place: 2 }
    ]);
  });
});
