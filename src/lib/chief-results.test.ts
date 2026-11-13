import { describe, expect, it } from "vitest";
import type { AccessView, RoundScores } from "@/data/access";
import { roleResults } from "./chief-results";

const leaders = ["1", "2", "3", "4"];
const view = {
  round: { yesCount: 1, altCount: 1, chiefJudgeCounts: false },
  competitors: leaders.map((bib) => ({ id: `l${bib}`, bib, role: "leader", name: "" })),
  heats: leaders.map((bib, i) => ({ role: "leader", heatNumber: 1, slot: i + 1, competitorId: `l${bib}`, redancer: false }))
} as unknown as AccessView;

const judges: RoundScores["judges"] = [
  { id: "j1", name: "Lee", assignment: "leaders", isChief: false },
  { id: "j2", name: "Kim", assignment: "leaders", isChief: false },
  { id: "cj", name: "Cat", assignment: "both", isChief: true }
];

const sheet = (judgeId: string, scores: Record<string, number>) =>
  Object.entries(scores).map(([bib, tenths]) => ({ judgeId, competitorId: `l${bib}`, tenths }));

describe("chief judge results", () => {
  it("waits for every judge scoring the role, including the chief judge", () => {
    const data: RoundScores = { judges, submissions: [{ judgeId: "j1", role: "leader" }], scores: [], cuts: [] };
    expect(roleResults(view, data, "leader", 1, 1).waiting).toEqual(["Kim", "Cat"]);
  });

  it("sums marks, breaks level points with the chief judge's scores, and applies a cut that differs from the Yes count", () => {
    const data: RoundScores = {
      judges,
      submissions: judges.map((j) => ({ judgeId: j.id, role: "leader" as const })),
      // Lee: 1 Yes, 2 Alt. Kim: 2 Yes, 1 Alt. So 1 and 2 are level on 14.5 points each.
      scores: [...sheet("j1", { "1": 900, "2": 800, "3": 100, "4": 50 }), ...sheet("j2", { "2": 900, "1": 800, "3": 100, "4": 50 }), ...sheet("cj", { "1": 700, "2": 750, "3": 400, "4": 300 })],
      cuts: []
    };
    const { rows, cutTie, waiting } = roleResults(view, data, "leader", 1, 2);
    expect(waiting).toEqual([]);
    expect(cutTie).toBeNull();
    expect(rows.map((r) => [r.bib, r.rank, r.pointsX100, r.status, r.alternateOrder])).toEqual([
      ["2", 1, 1450, "advancing", null],
      ["1", 2, 1450, "alternate", 1],
      ["3", 3, 0, "alternate", 2],
      ["4", 4, 0, "out", null]
    ]);
  });

  it("counts the chief judge when the round says so", () => {
    const counting = { ...view, round: { ...view.round, chiefJudgeCounts: true } } as AccessView;
    const data: RoundScores = {
      judges,
      submissions: [],
      scores: [...sheet("j1", { "3": 900 }), ...sheet("cj", { "3": 900, "1": 800 })],
      cuts: []
    };
    expect(roleResults(counting, data, "leader", 1, 0).rows[0]).toMatchObject({ bib: "3", pointsX100: 2000 });
  });

  it("reports a tie across the cut", () => {
    const data: RoundScores = { judges, submissions: [], scores: [...sheet("j1", { "1": 900 }), ...sheet("j2", { "2": 900 })], cuts: [] };
    expect(roleResults(view, data, "leader", 1, 0).cutTie).toEqual(["1", "2"]);
  });
});
