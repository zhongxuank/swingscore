import { deriveMarks } from "@/core/callback";
import { applyCut, rankEntries } from "@/core/ranking";
import type { ScoreSheet } from "@/core/ordinals";
import type { AccessView, CallbackStatus, CutResultRow, RoundScores } from "@/data/access";
import type { DancerRole, JudgeAssignment } from "@/data/types";
import { buildRoleSheet } from "./judge-sheet";

const scoresRole = (assignment: JudgeAssignment, role: DancerRole) =>
  assignment === "both" || (assignment === "leaders" ? role === "leader" : role === "follower");

export interface ChiefRow extends CutResultRow {
  bib: string;
  chiefScore: number | null;
}

export interface RoleResults {
  /** Judges (including the chief judge) who have not submitted this role yet. */
  waiting: string[];
  rows: ChiefRow[];
  /** Bibs still level after the chief judge's scores. Only a problem when it crosses the cut. */
  cutTie: string[] | null;
}

/**
 * Combines one role of a callback round for the chief judge: each counted judge's marks (from the Yes and
 * Alternate counts), summed into a ranking, with the chief judge's raw scores breaking level points, then the cut.
 */
export function roleResults(
  view: AccessView,
  data: RoundScores,
  role: DancerRole,
  cut: number,
  alternates: number
): RoleResults {
  const dancers = buildRoleSheet(view, role).dancers;
  const ids = dancers.map((d) => d.competitorId);
  const idSet = new Set(ids);
  const bibOf = new Map(dancers.map((d) => [d.competitorId, d.bib]));

  const scoring = data.judges.filter((judge) => scoresRole(judge.assignment, role));
  const submitted = new Set(data.submissions.filter((s) => s.role === role).map((s) => s.judgeId));
  const waiting = scoring.filter((judge) => !submitted.has(judge.id)).map((judge) => judge.name);

  const sheetOf = (judgeId: string): ScoreSheet =>
    Object.fromEntries(data.scores.filter((s) => s.judgeId === judgeId && idSet.has(s.competitorId)).map((s) => [s.competitorId, s.tenths]));

  const chief = scoring.find((judge) => judge.isChief);
  const counted = scoring.filter((judge) => !judge.isChief || view.round.chiefJudgeCounts);
  const yes = view.round.yesCount ?? 0;
  const alt = view.round.altCount ?? 0;
  const judgeMarks = counted.map((judge) => deriveMarks(sheetOf(judge.id), yes, alt).marks);
  const chiefSheet = chief ? sheetOf(chief.id) : {};

  const { rows } = rankEntries(ids, judgeMarks, chiefSheet);
  const boundedCut = Math.min(Math.max(cut, 0), rows.length);
  const { statuses, cutTie } = applyCut(rows, boundedCut, alternates);

  let alternateOrder = 0;
  const result: ChiefRow[] = [...rows]
    .sort((a, b) => a.rank - b.rank)
    .map((row) => {
      const status: CallbackStatus = statuses[row.entryId];
      return {
        competitorId: row.entryId,
        bib: bibOf.get(row.entryId)!,
        rank: row.rank,
        pointsX100: row.totalX100,
        status,
        alternateOrder: status === "alternate" ? (alternateOrder += 1) : null,
        chiefScore: chiefSheet[row.entryId] ?? null
      };
    });

  return { waiting, rows: result, cutTie: cutTie ? cutTie.map((id) => bibOf.get(id)!) : null };
}
