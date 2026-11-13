import type { Score } from "./score";
import type { ScoreSheet } from "./ordinals";

export interface CallbackProfile {
  yes: number;
  alt1: number;
  alt2: number;
  alt3: number;
  no: number;
}

/** Points carried over from the old Swingscore code and confirmed by the organiser on 2026-11-13. */
export const DEFAULT_CALLBACK_PROFILE: CallbackProfile = { yes: 10, alt1: 4.5, alt2: 4.3, alt3: 4.2, no: 0 };

export type MarkStatus = "yes" | "alt" | "no";

export interface Mark {
  entryId: string;
  score: Score;
  /** Position in this judge's ranking, 1 is highest. */
  rank: number;
  status: MarkStatus;
  altLevel?: 1 | 2 | 3;
  points: number;
}

/** Entries with equal scores whose positions would earn different points. The judge must fix these before submitting. */
export interface MarkTie {
  entryIds: string[];
  score: Score;
}

/**
 * Turns one judge's raw scores for one role into Yes, Alternate and No marks.
 * The top `yesCount` entries are Yes, the next `altCount` are Alternates (levels 1 to 3, the third level
 * covers any further alternates), and the rest are No.
 */
export function deriveMarks(
  sheet: ScoreSheet,
  yesCount: number,
  altCount: number,
  profile: CallbackProfile = DEFAULT_CALLBACK_PROFILE
): { marks: Mark[]; ties: MarkTie[] } {
  const ranked = Object.entries(sheet).sort((a, b) => b[1] - a[1]);

  const marks = ranked.map(([entryId, score], index): Mark => {
    const rank = index + 1;
    if (rank <= yesCount) return { entryId, score, rank, status: "yes", points: profile.yes };
    if (rank <= yesCount + altCount) {
      const altLevel = Math.min(rank - yesCount, 3) as 1 | 2 | 3;
      return { entryId, score, rank, status: "alt", altLevel, points: profile[`alt${altLevel}`] };
    }
    return { entryId, score, rank, status: "no", points: profile.no };
  });

  const ties: MarkTie[] = [];
  for (let start = 0; start < marks.length; ) {
    let end = start;
    while (end + 1 < marks.length && marks[end + 1].score === marks[start].score) end += 1;
    const group = marks.slice(start, end + 1);
    if (group.length > 1 && group.some((mark) => mark.points !== group[0].points)) {
      ties.push({ entryIds: group.map((mark) => mark.entryId), score: group[0].score });
    }
    start = end + 1;
  }

  return { marks, ties };
}
