import type {
  AlternatePointProfile,
  AdvancementRow,
  BoundaryTie,
  ChiefJudgeMode,
  Competitor,
  PrelimJudgeMark,
  RawScore
} from "@/lib/types";

export const DEFAULT_ALT_PROFILE: AlternatePointProfile = {
  yes: 10,
  alt1: 4.5,
  alt2: 4.3,
  alt3: 4.2,
  no: 0
};

interface DeriveJudgeMarksInput {
  competitors: Competitor[];
  scores: RawScore[];
  requiredYeses: number;
  requiredAlts: number;
  profile?: AlternatePointProfile;
}

interface AdvancementInput {
  competitors: Competitor[];
  panelScores: RawScore[];
  chiefScores?: RawScore[];
  requiredYeses: number;
  requiredAlts: number;
  advancementCount: number;
  chiefJudgeMode: ChiefJudgeMode;
  profile?: AlternatePointProfile;
}

export function deriveJudgePrelimMarks({
  competitors,
  scores,
  requiredYeses,
  requiredAlts,
  profile = DEFAULT_ALT_PROFILE
}: DeriveJudgeMarksInput): { marks: PrelimJudgeMark[]; ties: BoundaryTie[] } {
  const competitorIds = new Set(competitors.map((competitor) => competitor.id));
  const ranked = scores
    .filter((score) => competitorIds.has(score.subjectId))
    .slice()
    .sort((a, b) => b.scoreX2 - a.scoreX2 || a.subjectId.localeCompare(b.subjectId));

  const marks = ranked.map((score, index): PrelimJudgeMark => {
    const position = index + 1;
    if (position <= requiredYeses) {
      return {
        competitorId: score.subjectId,
        scoreX2: score.scoreX2,
        rank: position,
        status: "yes",
        points: profile.yes
      };
    }

    if (position <= requiredYeses + requiredAlts) {
      const altPosition = Math.min(Math.max(position - requiredYeses, 1), 3) as 1 | 2 | 3;
      return {
        competitorId: score.subjectId,
        scoreX2: score.scoreX2,
        rank: position,
        status: "alt",
        altLevel: altPosition,
        points: profile[`alt${altPosition}`]
      };
    }

    return {
      competitorId: score.subjectId,
      scoreX2: score.scoreX2,
      rank: position,
      status: "no",
      points: profile.no
    };
  });

  return {
    marks,
    ties: [
      ...detectScoreBoundaryTie(ranked, requiredYeses, "yes"),
      ...detectScoreBoundaryTie(ranked, requiredYeses + requiredAlts, "alternate")
    ]
  };
}

export function calculatePrelimAdvancement({
  competitors,
  panelScores,
  chiefScores = [],
  requiredYeses,
  requiredAlts,
  advancementCount,
  chiefJudgeMode,
  profile = DEFAULT_ALT_PROFILE
}: AdvancementInput): { rows: AdvancementRow[]; ties: BoundaryTie[]; judgeMarks: PrelimJudgeMark[] } {
  const scoresForAggregation =
    chiefJudgeMode === "full_panel" ? [...panelScores, ...chiefScores] : panelScores;
  const judgeIds = Array.from(new Set(scoresForAggregation.map((score) => score.judgeId)));
  const judgeMarks: PrelimJudgeMark[] = [];
  const ties: BoundaryTie[] = [];
  const totals = new Map<string, number>();

  for (const judgeId of judgeIds) {
    const judgeScores = scoresForAggregation.filter((score) => score.judgeId === judgeId);
    const { marks, ties: judgeTies } = deriveJudgePrelimMarks({
      competitors,
      scores: judgeScores,
      requiredYeses,
      requiredAlts,
      profile
    });

    judgeMarks.push(...marks);
    ties.push(...judgeTies.map((tie) => ({ ...tie, role: competitors[0]?.role })));

    for (const mark of marks) {
      totals.set(mark.competitorId, (totals.get(mark.competitorId) ?? 0) + mark.points);
    }
  }

  const chiefScoreByCompetitor = new Map(
    chiefScores.map((score) => [score.subjectId, score.scoreX2] as const)
  );

  const sorted = competitors
    .map((competitor) => ({
      competitor,
      totalPoints: totals.get(competitor.id) ?? 0,
      chiefJudgeScoreX2: chiefScoreByCompetitor.get(competitor.id)
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (chiefJudgeMode === "tiebreak_only") {
        const chiefDelta = (b.chiefJudgeScoreX2 ?? -1) - (a.chiefJudgeScoreX2 ?? -1);
        if (chiefDelta !== 0) return chiefDelta;
      }
      return a.competitor.bibNumber.localeCompare(b.competitor.bibNumber, undefined, {
        numeric: true
      });
    });

  const advancementTie = detectPointBoundaryTie(sorted, advancementCount, chiefJudgeMode);
  ties.push(...advancementTie);

  const rows = sorted.map((row, index): AdvancementRow => {
    const rank = index + 1;
    return {
      competitorId: row.competitor.id,
      role: row.competitor.role,
      totalPoints: row.totalPoints,
      rank,
      status: rank <= advancementCount ? "advancing" : rank <= advancementCount + 2 ? "alternate" : "out",
      chiefJudgeScoreX2: row.chiefJudgeScoreX2
    };
  });

  return { rows, ties, judgeMarks };
}

function detectScoreBoundaryTie(
  ranked: RawScore[],
  boundary: number,
  kind: "yes" | "alternate"
): BoundaryTie[] {
  if (boundary <= 0 || boundary >= ranked.length) return [];
  const before = ranked[boundary - 1];
  const after = ranked[boundary];
  if (!before || !after || before.scoreX2 !== after.scoreX2) return [];

  const tiedSubjectIds = ranked
    .filter((score) => score.scoreX2 === before.scoreX2)
    .map((score) => score.subjectId);

  return [
    {
      kind,
      boundary,
      subjectIds: tiedSubjectIds,
      score: before.scoreX2
    }
  ];
}

function detectPointBoundaryTie(
  sorted: Array<{ competitor: Competitor; totalPoints: number; chiefJudgeScoreX2?: number }>,
  boundary: number,
  chiefJudgeMode: ChiefJudgeMode
): BoundaryTie[] {
  if (boundary <= 0 || boundary >= sorted.length) return [];
  const before = sorted[boundary - 1];
  const after = sorted[boundary];
  if (!before || !after || before.totalPoints !== after.totalPoints) return [];

  const tied = sorted.filter((row) => row.totalPoints === before.totalPoints);
  const chiefScores = new Set(tied.map((row) => row.chiefJudgeScoreX2).filter(Boolean));
  const resolvedByChiefJudge = chiefJudgeMode === "tiebreak_only" && chiefScores.size > 1;

  return [
    {
      kind: "advancement",
      boundary,
      role: before.competitor.role,
      subjectIds: tied.map((row) => row.competitor.id),
      points: before.totalPoints,
      resolvedByChiefJudge
    }
  ];
}
