import { describe, expect, it } from "vitest";
import type { Competitor, RawScore } from "@/lib/types";
import { calculatePrelimAdvancement, deriveJudgePrelimMarks } from "@/lib/scoring/prelims";

const competitors: Competitor[] = [
  { id: "A", bibNumber: "101", preferredName: "A", role: "Leader" },
  { id: "B", bibNumber: "102", preferredName: "B", role: "Leader" },
  { id: "C", bibNumber: "103", preferredName: "C", role: "Leader" },
  { id: "D", bibNumber: "104", preferredName: "D", role: "Leader" }
];

function scores(judgeId: string, values: Record<string, number>): RawScore[] {
  return Object.entries(values).map(([subjectId, scoreX2]) => ({
    judgeId,
    subjectId,
    role: "Leader",
    scoreX2
  }));
}

describe("prelim scoring", () => {
  it("derives yes, alternate, and no from raw scores", () => {
    const result = deriveJudgePrelimMarks({
      competitors,
      scores: scores("J1", { A: 190, B: 180, C: 170, D: 160 }),
      requiredYeses: 2,
      requiredAlts: 1
    });

    expect(result.marks.map((mark) => [mark.competitorId, mark.status, mark.points])).toEqual([
      ["A", "yes", 10],
      ["B", "yes", 10],
      ["C", "alt", 4.5],
      ["D", "no", 0]
    ]);
  });

  it("allows non-boundary ties and reports only meaningful ties", () => {
    const result = deriveJudgePrelimMarks({
      competitors,
      scores: scores("J1", { A: 190, B: 180, C: 180, D: 160 }),
      requiredYeses: 1,
      requiredAlts: 2
    });

    expect(result.ties).toHaveLength(0);
  });

  it("uses Chief Judge raw scores only after an advancement tie", () => {
    const result = calculatePrelimAdvancement({
      competitors,
      panelScores: [
        ...scores("J1", { A: 190, B: 180, C: 170, D: 160 }),
        ...scores("J2", { B: 190, A: 180, C: 170, D: 160 })
      ],
      chiefScores: scores("chief", { B: 196, A: 194, C: 170, D: 160 }).map((score) => ({
        ...score,
        isChiefJudge: true
      })),
      requiredYeses: 1,
      requiredAlts: 1,
      advancementCount: 1,
      chiefJudgeMode: "tiebreak_only"
    });

    expect(result.rows[0]?.competitorId).toBe("B");
    expect(result.ties[0]?.resolvedByChiefJudge).toBe(true);
  });
});
