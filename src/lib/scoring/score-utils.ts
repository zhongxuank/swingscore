import type { RawScore } from "@/lib/types";

export const MIN_SCORE_X2 = 2;
export const MAX_SCORE_X2 = 200;

export function toScoreX2(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(numeric)) return Number.NaN;
  return Math.round(numeric * 2);
}

export function formatScore(scoreX2: number): string {
  if (scoreX2 === 0) return "0";
  return (scoreX2 / 2).toFixed(1);
}

export function isValidScoreX2(scoreX2: number): boolean {
  return (
    Number.isInteger(scoreX2) &&
    (scoreX2 === 0 || (scoreX2 >= MIN_SCORE_X2 && scoreX2 <= MAX_SCORE_X2))
  );
}

export function validateScoreSheet(scores: RawScore[], requireUnique: boolean): string[] {
  const errors: string[] = [];
  const seen = new Map<number, string[]>();

  for (const score of scores) {
    if (!isValidScoreX2(score.scoreX2)) {
      errors.push(`${score.subjectId} has an invalid score.`);
    }

    if (score.scoreX2 === 0) {
      errors.push(`${score.subjectId} is unscored.`);
      continue;
    }

    if (requireUnique) {
      const existing = seen.get(score.scoreX2) ?? [];
      existing.push(score.subjectId);
      seen.set(score.scoreX2, existing);
    }
  }

  if (requireUnique) {
    for (const [scoreX2, subjectIds] of seen.entries()) {
      if (subjectIds.length > 1) {
        errors.push(`Duplicate score ${formatScore(scoreX2)} for ${subjectIds.join(", ")}.`);
      }
    }
  }

  return errors;
}

export function groupScoresByJudge(scores: RawScore[]): Map<string, RawScore[]> {
  const byJudge = new Map<string, RawScore[]>();
  for (const score of scores) {
    const judgeScores = byJudge.get(score.judgeId) ?? [];
    judgeScores.push(score);
    byJudge.set(score.judgeId, judgeScores);
  }
  return byJudge;
}
