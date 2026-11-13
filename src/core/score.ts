/** A raw score in whole tenths: 0 to 1000, shown as 0.0 to 100.0. An unscored entry has no value, so 0 is a real score. */
export type Score = number;

export const MIN_SCORE: Score = 0;
export const MAX_SCORE: Score = 1000;

export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= MIN_SCORE && score <= MAX_SCORE;
}

/** Turns "87.5" or 87.5 into tenths. Returns null for blank, non-numeric or out-of-range input. */
export function parseScore(input: string | number): Score | null {
  if (typeof input === "string" && input.trim() === "") return null;
  const value = typeof input === "number" ? input : Number(input.trim());
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 10);
}

export function formatScore(score: Score): string {
  return (score / 10).toFixed(1);
}
