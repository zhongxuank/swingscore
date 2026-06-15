import type { BoundaryTie, FinalPlacementRow, RawScore } from "@/lib/types";

export interface OrdinalSheet {
  judgeId: string;
  ordinals: Record<string, number>;
}

export function convertRawScoresToOrdinals(scores: RawScore[]): OrdinalSheet {
  const sorted = scores
    .slice()
    .sort((a, b) => b.scoreX2 - a.scoreX2 || a.subjectId.localeCompare(b.subjectId));

  return {
    judgeId: scores[0]?.judgeId ?? "unknown",
    ordinals: Object.fromEntries(sorted.map((score, index) => [score.subjectId, index + 1]))
  };
}

export function calculateRelativePlacements(
  coupleIds: string[],
  sheets: OrdinalSheet[]
): { placements: FinalPlacementRow[]; ties: BoundaryTie[] } {
  const majority = Math.floor(sheets.length / 2) + 1;
  const remaining = new Set(coupleIds);
  const placements: FinalPlacementRow[] = [];
  const ties: BoundaryTie[] = [];
  let placement = 1;

  for (let level = 1; remaining.size > 0 && level <= coupleIds.length; level += 1) {
    const candidates = Array.from(remaining)
      .map((coupleId) => buildCandidate(coupleId, sheets, level))
      .filter((candidate) => candidate.count >= majority);

    if (candidates.length === 0) continue;

    const ordered = candidates.sort((a, b) => compareCandidates(a.coupleId, b.coupleId, sheets, level));

    for (const candidate of ordered) {
      placements.push({
        coupleId: candidate.coupleId,
        placement,
        majorityAt: level,
        majorityCount: candidate.count,
        ordinalSum: candidate.sum
      });
      remaining.delete(candidate.coupleId);
      placement += 1;
    }
  }

  if (remaining.size > 0) {
    const unresolved = Array.from(remaining).sort((a, b) => compareCandidates(a, b, sheets, coupleIds.length));
    ties.push({
      kind: "placement",
      boundary: placement,
      subjectIds: unresolved
    });

    for (const coupleId of unresolved) {
      const candidate = buildCandidate(coupleId, sheets, coupleIds.length);
      placements.push({
        coupleId,
        placement,
        majorityAt: coupleIds.length,
        majorityCount: candidate.count,
        ordinalSum: candidate.sum
      });
      placement += 1;
    }
  }

  return { placements, ties };
}

function buildCandidate(coupleId: string, sheets: OrdinalSheet[], level: number) {
  const ordinals = sheets.map((sheet) => sheet.ordinals[coupleId] ?? Number.POSITIVE_INFINITY);
  const qualifying = ordinals.filter((ordinal) => ordinal <= level);
  return {
    coupleId,
    count: qualifying.length,
    sum: qualifying.reduce((total, ordinal) => total + ordinal, 0)
  };
}

function compareCandidates(a: string, b: string, sheets: OrdinalSheet[], startLevel: number): number {
  const maxLevel = Math.max(
    ...sheets.flatMap((sheet) => [sheet.ordinals[a] ?? 0, sheet.ordinals[b] ?? 0])
  );

  for (let level = startLevel; level <= maxLevel; level += 1) {
    const aCandidate = buildCandidate(a, sheets, level);
    const bCandidate = buildCandidate(b, sheets, level);
    if (aCandidate.count !== bCandidate.count) return bCandidate.count - aCandidate.count;
    if (aCandidate.sum !== bCandidate.sum) return aCandidate.sum - bCandidate.sum;
  }

  const pairwise = comparePairwiseMajority(a, b, sheets);
  if (pairwise !== 0) return pairwise;

  return a.localeCompare(b);
}

function comparePairwiseMajority(a: string, b: string, sheets: OrdinalSheet[]): number {
  let aWins = 0;
  let bWins = 0;

  for (const sheet of sheets) {
    const aOrdinal = sheet.ordinals[a] ?? Number.POSITIVE_INFINITY;
    const bOrdinal = sheet.ordinals[b] ?? Number.POSITIVE_INFINITY;
    if (aOrdinal < bOrdinal) aWins += 1;
    if (bOrdinal < aOrdinal) bWins += 1;
  }

  if (aWins === bWins) return 0;
  return aWins > bWins ? -1 : 1;
}
