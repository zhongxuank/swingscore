import { toOrdinals, type Ordinals } from "@/core/ordinals";
import { relativePlacement, type RelativePlacementResult } from "@/core/relative-placement";
import type { FinalCouple, FinalPlacement, FinalScoreRow, RoundJudge, SheetSubmission } from "@/data/types";

export interface FinalTally {
  /** Counted judges who have not submitted yet. */
  waiting: string[];
  /** Why Relative Placement cannot run yet, in plain words. */
  problems: string[];
  result: RelativePlacementResult | null;
  /** Each counted judge's ordinals, for the results table. */
  ordinals: Array<{ judge: string; ordinals: Ordinals }>;
}

/**
 * Runs Relative Placement on a final once every counted judge has submitted. The chief judge counts only
 * when the round's toggle says so, and is never a tiebreaker here.
 */
export function tallyFinal(
  couples: FinalCouple[],
  judges: RoundJudge[],
  submissions: SheetSubmission[],
  scores: FinalScoreRow[],
  chiefJudgeCounts: boolean
): FinalTally {
  const counted = judges.filter((judge) => !judge.isChief || chiefJudgeCounts);
  const submitted = new Set(submissions.map((s) => s.judgeId));
  const waiting = counted.filter((judge) => !submitted.has(judge.id)).map((judge) => judge.name);
  const problems: string[] = [];
  if (couples.length === 0) problems.push("Set the couples first.");
  if (counted.length === 0 || counted.length % 2 === 0) problems.push(`The counted panel must be an odd number of judges. It has ${counted.length}.`);
  if (waiting.length > 0 || problems.length > 0) return { waiting, problems, result: null, ordinals: [] };

  const coupleIds = new Set(couples.map((c) => c.id));
  const ordinals: FinalTally["ordinals"] = [];
  for (const judge of counted) {
    const sheet = Object.fromEntries(scores.filter((s) => s.judgeId === judge.id && coupleIds.has(s.coupleId)).map((s) => [s.coupleId, s.tenths]));
    if (Object.keys(sheet).length !== couples.length) {
      problems.push(`${judge.name}'s sheet is missing a couple.`);
      continue;
    }
    const converted = toOrdinals(sheet);
    if (!converted.ok) {
      problems.push(`${judge.name} has equal scores. Reopen their sheet so they can fix it.`);
      continue;
    }
    ordinals.push({ judge: judge.name, ordinals: converted.ordinals });
  }
  if (problems.length > 0) return { waiting, problems, result: null, ordinals: [] };
  return { waiting, problems, result: relativePlacement([...coupleIds], ordinals.map((o) => o.ordinals)), ordinals };
}

/**
 * Turns the Relative Placement result into one place per couple. Couples in an unresolved tie are placed in
 * the order the organiser chose (`tieOrders`, keyed by the tie's first place); without a choice they are not ready.
 */
export function finalPlacements(result: RelativePlacementResult, tieOrders: Record<number, string[]>): FinalPlacement[] | null {
  const placements: FinalPlacement[] = [];
  const tied = new Set(result.unresolved.flatMap((tie) => tie.entryIds));
  for (const placement of result.placements) {
    if (!tied.has(placement.entryId)) placements.push({ coupleId: placement.entryId, place: placement.place });
  }
  for (const tie of result.unresolved) {
    const order = tieOrders[tie.places[0]];
    if (!order || order.length !== tie.entryIds.length || !tie.entryIds.every((id) => order.includes(id))) return null;
    order.forEach((coupleId, index) => placements.push({ coupleId, place: tie.places[0] + index }));
  }
  return placements.sort((a, b) => a.place - b.place);
}
