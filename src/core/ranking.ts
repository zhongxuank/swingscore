import type { Mark } from "./callback";
import type { Score } from "./score";
import type { ScoreSheet } from "./ordinals";

export interface RankedEntry {
  entryId: string;
  /** Sum of all judges' mark points, in hundredths to avoid float drift. */
  totalX100: number;
  /** Tied entries share a rank. Entries the chief judge separated have different ranks. */
  rank: number;
  chiefScore?: Score;
}

export interface RankingTie {
  entryIds: string[];
  ranks: [number, number];
  /** True when the chief judge has not scored every tied entry yet. False means their scores tied, which should be blocked at submission. */
  needsChiefScores: boolean;
}

/**
 * Combines every judge's marks for one role into one ranking.
 * Entries level on points are ordered by the chief judge's raw scores. The chief judge's scores never
 * change the points. If a tied group has no usable chief scores it stays tied and is reported.
 */
export function rankEntries(
  entryIds: string[],
  judgeMarks: Mark[][],
  chiefSheet: ScoreSheet = {}
): { rows: RankedEntry[]; ties: RankingTie[] } {
  const totals = new Map<string, number>(entryIds.map((id) => [id, 0]));
  for (const marks of judgeMarks) {
    for (const mark of marks) {
      if (!totals.has(mark.entryId)) continue;
      totals.set(mark.entryId, totals.get(mark.entryId)! + Math.round(mark.points * 100));
    }
  }

  const byPoints = [...entryIds].sort((a, b) => totals.get(b)! - totals.get(a)!);
  const rows: RankedEntry[] = [];
  const ties: RankingTie[] = [];

  for (let start = 0; start < byPoints.length; ) {
    let end = start;
    while (end + 1 < byPoints.length && totals.get(byPoints[end + 1]) === totals.get(byPoints[start])) end += 1;
    const group = byPoints.slice(start, end + 1);
    const firstRank = start + 1;

    if (group.length === 1) {
      rows.push({ entryId: group[0], totalX100: totals.get(group[0])!, rank: firstRank });
    } else {
      const scored = group.every((id) => chiefSheet[id] !== undefined);
      const ordered = scored ? [...group].sort((a, b) => chiefSheet[b] - chiefSheet[a]) : group;
      const equalChief = new Set<string>();
      let rank = firstRank;
      ordered.forEach((id, index) => {
        if (scored && index > 0) {
          const previous = ordered[index - 1];
          if (chiefSheet[previous] === chiefSheet[id]) {
            equalChief.add(previous);
            equalChief.add(id);
          } else {
            rank = firstRank + index;
          }
        }
        rows.push({ entryId: id, totalX100: totals.get(id)!, rank, chiefScore: chiefSheet[id] });
      });
      if (!scored) {
        ties.push({ entryIds: group, ranks: [firstRank, firstRank + group.length - 1], needsChiefScores: true });
      } else if (equalChief.size > 0) {
        const ranks = [...equalChief].map((id) => rows.find((row) => row.entryId === id)!.rank);
        ties.push({ entryIds: [...equalChief], ranks: [Math.min(...ranks), Math.max(...ranks)], needsChiefScores: false });
      }
    }
    start = end + 1;
  }

  return { rows, ties };
}

export type CutStatus = "advancing" | "alternate" | "out";

export interface CutResult {
  statuses: Record<string, CutStatus>;
  /** Entries still tied across the cut line. The chief judge cannot decide the cut until these are separated. */
  cutTie: string[] | null;
}

/** Applies the chief judge's cut and alternate count to a ranking. */
export function applyCut(rows: RankedEntry[], cut: number, alternateCount: number): CutResult {
  const statuses: Record<string, CutStatus> = {};
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  sorted.forEach((row, index) => {
    const position = index + 1;
    statuses[row.entryId] = position <= cut ? "advancing" : position <= cut + alternateCount ? "alternate" : "out";
  });

  const lastIn = sorted[cut - 1];
  const firstOut = sorted[cut];
  const cutTie =
    cut > 0 && lastIn && firstOut && lastIn.rank === firstOut.rank
      ? sorted.filter((row) => row.rank === lastIn.rank).map((row) => row.entryId)
      : null;

  return { statuses, cutTie };
}
