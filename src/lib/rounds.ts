import type { AdvancementRow, Competitor, Couple, HeatEntry, Judge, RoundConfig, RoundStage, ScoringMethod } from "@/lib/types";

export const callbackRoundStages: RoundStage[] = ["prelim", "quarter_final", "semi_final"];

export function isCallbackRound(round: Pick<RoundConfig, "scoringMethod">) {
  return round.scoringMethod === "callback";
}

export function isFinalRound(round: Pick<RoundConfig, "scoringMethod">) {
  return round.scoringMethod === "relative_placement";
}

export function roundStageLabel(stage: RoundStage) {
  if (stage === "quarter_final") return "Quarter-Final";
  if (stage === "semi_final") return "Semi-Final";
  if (stage === "final") return "Final";
  return "Prelim";
}

export function scoringMethodLabel(method: ScoringMethod) {
  return method === "callback" ? "Callback Round" : "Final Round";
}

export function roundTypeLabel(round: Pick<RoundConfig, "stage" | "scoringMethod">) {
  return `${roundStageLabel(round.stage)} ${scoringMethodLabel(round.scoringMethod)}`;
}

export function chiefJudgeCountsForRound(
  round: Pick<RoundConfig, "scoringMethod" | "leaderChiefJudgeMode" | "followerChiefJudgeMode" | "chiefJudgeCountsForFinal">
) {
  if (round.scoringMethod === "relative_placement") {
    return Boolean(round.chiefJudgeCountsForFinal);
  }

  return round.leaderChiefJudgeMode === "full_panel" || round.followerChiefJudgeMode === "full_panel";
}

export function nextCallbackStage(existingRounds: RoundConfig[]): RoundStage {
  if (existingRounds.some((round) => round.stage === "quarter_final")) return "semi_final";
  if (existingRounds.some((round) => round.stage === "semi_final")) return "semi_final";
  return "semi_final";
}

export function generateHeatEntries({
  competitors,
  roundId,
  heatCount,
  maxDancersPerHeat
}: {
  competitors: Competitor[];
  roundId: string;
  heatCount?: number;
  maxDancersPerHeat?: number;
}): HeatEntry[] {
  const leaders = competitorsForRole(competitors, "Leader");
  const followers = competitorsForRole(competitors, "Follower");
  const resolvedHeatCount =
    heatCount && heatCount > 0
      ? heatCount
      : Math.max(1, Math.ceil(Math.max(leaders.length, followers.length) / Math.max(1, maxDancersPerHeat ?? 4)));

  return (["Leader", "Follower"] as const).flatMap((role) => {
    const roleCompetitors = competitorsForRole(competitors, role);
    return roleCompetitors.map((competitor, index) => {
      const heatNumber = maxDancersPerHeat && maxDancersPerHeat > 0
        ? Math.floor(index / maxDancersPerHeat) + 1
        : (index % resolvedHeatCount) + 1;

      return {
        id: `${roundId}-heat-${competitor.id}`,
        roundId,
        heatNumber,
        competitorId: competitor.id,
        role,
        isFiller: Boolean(competitor.isFiller)
      };
    });
  });
}

export function competitorsFromAdvancement({
  competitors,
  rows,
  includeAlternates = false
}: {
  competitors: Competitor[];
  rows: AdvancementRow[];
  includeAlternates?: boolean;
}) {
  const acceptedStatuses = includeAlternates ? new Set(["advancing", "alternate"]) : new Set(["advancing"]);
  const acceptedIds = new Set(rows.filter((row) => acceptedStatuses.has(row.status)).map((row) => row.competitorId));
  return competitors
    .filter((competitor) => acceptedIds.has(competitor.id))
    .sort((a, b) => roleSort(a.role) - roleSort(b.role) || a.bibNumber.localeCompare(b.bibNumber, undefined, { numeric: true }));
}

export function validateFinalScoringPanel({
  judges,
  chiefJudgeCounts
}: {
  judges: Judge[];
  chiefJudgeCounts: boolean;
}) {
  const scoringJudges = judges.filter((judge) => !judge.isChiefJudge || chiefJudgeCounts);
  const errors: string[] = [];

  if (scoringJudges.length < 3) {
    errors.push("Final rounds need at least 3 scoring judges.");
  }

  if (scoringJudges.length % 2 === 0) {
    errors.push("Final rounds need an odd number of scoring judges.");
  }

  return {
    scoringJudgeCount: scoringJudges.length,
    scoringJudgeIds: scoringJudges.map((judge) => judge.id),
    errors
  };
}

export function validateFinalPairings(couples: Couple[]) {
  const errors: string[] = [];
  const seenLeaders = new Set<string>();
  const seenFollowers = new Set<string>();

  for (const couple of couples) {
    if (seenLeaders.has(couple.leaderId)) {
      errors.push(`Leader ${couple.leaderId} appears in more than one finals row.`);
    }
    seenLeaders.add(couple.leaderId);

    if (!couple.followerId) {
      errors.push(`Dance order ${couple.danceOrder} is missing a follower bib.`);
      continue;
    }

    if (seenFollowers.has(couple.followerId)) {
      errors.push(`Follower ${couple.followerId} appears in more than one finals row.`);
    }
    seenFollowers.add(couple.followerId);
  }

  return errors;
}

function competitorsForRole(competitors: Competitor[], role: "Leader" | "Follower") {
  return competitors
    .filter((competitor) => competitor.role === role)
    .sort((a, b) => a.bibNumber.localeCompare(b.bibNumber, undefined, { numeric: true }));
}

function roleSort(role: "Leader" | "Follower") {
  return role === "Leader" ? 0 : 1;
}
