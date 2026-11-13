import { isValidScore, type Score } from "./score";

export type ScoreSheet = Record<string, Score>;
export type Ordinals = Record<string, number>;

export interface DuplicateScore {
  score: Score;
  entryIds: string[];
}

export type OrdinalResult =
  | { ok: true; ordinals: Ordinals }
  | { ok: false; duplicates: DuplicateScore[] };

/**
 * Converts one judge's raw scores to ordinals (highest score is 1).
 * Relative Placement requires unique scores, so equal scores are reported, never broken by id.
 */
export function toOrdinals(sheet: ScoreSheet): OrdinalResult {
  const entries = Object.entries(sheet);
  for (const [entryId, score] of entries) {
    if (!isValidScore(score)) throw new RangeError(`Invalid score for ${entryId}: ${score}`);
  }

  const byScore = new Map<Score, string[]>();
  for (const [entryId, score] of entries) {
    byScore.set(score, [...(byScore.get(score) ?? []), entryId]);
  }
  const duplicates = [...byScore.entries()]
    .filter(([, entryIds]) => entryIds.length > 1)
    .map(([score, entryIds]) => ({ score, entryIds }));
  if (duplicates.length > 0) return { ok: false, duplicates };

  const ordered = entries.sort((a, b) => b[1] - a[1]);
  return {
    ok: true,
    ordinals: Object.fromEntries(ordered.map(([entryId], index) => [entryId, index + 1]))
  };
}
