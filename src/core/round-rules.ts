export type RoundStage = "prelim" | "quarter_final" | "semi_final" | "final";
export type RoundKind = "callback" | "final";

export const ROUND_STAGES: readonly RoundStage[] = ["prelim", "quarter_final", "semi_final", "final"];

export const STAGE_LABELS: Record<RoundStage, string> = {
  prelim: "Prelim",
  quarter_final: "Quarter-Final",
  semi_final: "Semi-Final",
  final: "Final"
};

/** Every stage before the final is scored by callbacks. The final is scored with Relative Placement. */
export function kindForStage(stage: RoundStage): RoundKind {
  return stage === "final" ? "final" : "callback";
}

/**
 * Checks whether a round at `stage` can be added after the rounds already in a contest.
 * Stages run in order and a stage can be used once. A contest may start at any stage and skip stages.
 * Returns an error message, or null when the round is allowed.
 */
export function checkNewStage(existing: readonly RoundStage[], stage: RoundStage): string | null {
  if (existing.includes("final")) return "No round can be added after the final.";
  const last = existing.reduce((max, current) => Math.max(max, ROUND_STAGES.indexOf(current)), -1);
  if (ROUND_STAGES.indexOf(stage) <= last) {
    return `${STAGE_LABELS[stage]} must come after ${STAGE_LABELS[ROUND_STAGES[last]]}.`;
  }
  return null;
}
