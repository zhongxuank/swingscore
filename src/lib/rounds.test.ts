import { describe, expect, it } from "vitest";
import type { AdvancementRow, Competitor, Couple, Judge } from "@/lib/types";
import { competitorsFromAdvancement, generateHeatEntries, validateFinalPairings, validateFinalScoringPanel } from "@/lib/rounds";

const competitors: Competitor[] = [
  { id: "L101", bibNumber: "101", preferredName: "Alex", role: "Leader" },
  { id: "L102", bibNumber: "102", preferredName: "Morgan", role: "Leader" },
  { id: "L103", bibNumber: "103", preferredName: "Sam", role: "Leader" },
  { id: "F201", bibNumber: "201", preferredName: "Jamie", role: "Follower" },
  { id: "F202", bibNumber: "202", preferredName: "Avery", role: "Follower" }
];

describe("round setup helpers", () => {
  it("generates callback heats by role with capacity settings", () => {
    const heats = generateHeatEntries({ competitors, roundId: "round-semi", maxDancersPerHeat: 2 });

    expect(heats.filter((entry) => entry.role === "Leader").map((entry) => entry.heatNumber)).toEqual([1, 1, 2]);
    expect(heats.filter((entry) => entry.role === "Follower").map((entry) => entry.heatNumber)).toEqual([1, 1]);
  });

  it("persists advancing contestants into the next callback round", () => {
    const rows: AdvancementRow[] = [
      { competitorId: "L102", role: "Leader", totalPoints: 20, rank: 1, status: "advancing" },
      { competitorId: "L101", role: "Leader", totalPoints: 10, rank: 2, status: "alternate" },
      { competitorId: "F201", role: "Follower", totalPoints: 20, rank: 1, status: "advancing" }
    ];

    expect(competitorsFromAdvancement({ competitors, rows }).map((competitor) => competitor.id)).toEqual(["L102", "F201"]);
  });

  it("requires an odd finals scoring panel and honors whether the Chief Judge counts", () => {
    const judges: Judge[] = [
      { id: "j1", name: "One", roleAssignment: "both" },
      { id: "j2", name: "Two", roleAssignment: "both" },
      { id: "chief", name: "Chief", roleAssignment: "both", isChiefJudge: true }
    ];

    expect(validateFinalScoringPanel({ judges, chiefJudgeCounts: false }).errors).toContain("Final rounds need at least 3 scoring judges.");
    expect(validateFinalScoringPanel({ judges, chiefJudgeCounts: true })).toMatchObject({
      scoringJudgeCount: 3,
      errors: []
    });
  });

  it("blocks finalization when finals pairings are incomplete", () => {
    const couples: Couple[] = [
      { id: "C1", leaderId: "L101", danceOrder: 1 },
      { id: "C2", leaderId: "L102", followerId: "F201", danceOrder: 2 }
    ];

    expect(validateFinalPairings(couples)).toEqual(["Dance order 1 is missing a follower bib."]);
  });
});
