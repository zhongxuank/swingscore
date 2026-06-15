import type { AdvancementRow, Competitor, Couple, FinalPlacementRow, Judge, RawScore } from "@/lib/types";
import { formatScore } from "@/lib/scoring/score-utils";
import { toCsv } from "@/lib/scoring/csv";

export function rawScoresCsv({
  judges,
  competitors,
  couples,
  scores
}: {
  judges: Judge[];
  competitors?: Competitor[];
  couples?: Couple[];
  scores: RawScore[];
}): string {
  const subjects = new Map<string, string>();
  for (const competitor of competitors ?? []) {
    subjects.set(competitor.id, `${competitor.role[0]}${competitor.bibNumber} ${competitor.preferredName}`);
  }
  for (const couple of couples ?? []) {
    subjects.set(couple.id, `Couple ${couple.danceOrder}`);
  }

  return toCsv(
    scores.map((score) => ({
      Judge: judges.find((judge) => judge.id === score.judgeId)?.name ?? score.judgeId,
      Subject: subjects.get(score.subjectId) ?? score.subjectId,
      Role: score.role,
      "Raw Score": formatScore(score.scoreX2),
      "Chief Judge": score.isChiefJudge ? "Yes" : "No"
    }))
  );
}

export function advancementCsv(rows: AdvancementRow[], competitors: Competitor[]): string {
  return toCsv(
    rows.map((row) => {
      const competitor = competitors.find((item) => item.id === row.competitorId);
      return {
        Rank: row.rank,
        Bib: competitor?.bibNumber,
        Name: competitor?.preferredName,
        Role: row.role,
        Points: row.totalPoints,
        Status: row.status
      };
    })
  );
}

export function placementsCsv(rows: FinalPlacementRow[], couples: Couple[], competitors: Competitor[]): string {
  return toCsv(
    rows.map((row) => {
      const couple = couples.find((item) => item.id === row.coupleId);
      const leader = competitors.find((competitor) => competitor.id === couple?.leaderId);
      const follower = competitors.find((competitor) => competitor.id === couple?.followerId);
      return {
        Placement: row.placement,
        Couple: couple ? `L${leader?.bibNumber}/F${follower?.bibNumber}` : row.coupleId,
        Leader: leader?.preferredName,
        Follower: follower?.preferredName,
        "Majority At": row.majorityAt,
        "Majority Count": row.majorityCount,
        "Ordinal Sum": row.ordinalSum
      };
    })
  );
}
