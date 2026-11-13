import type { RoundKind, RoundStage } from "@/core/round-rules";

export interface Contest {
  id: string;
  name: string;
  createdAt: string;
  /** Set when the contest is archived. Archived contests are hidden but never deleted. */
  archivedAt: string | null;
}

export type RoundStatus = "setup" | "scoring" | "complete";

export interface Round {
  id: string;
  contestId: string;
  /** 1-based order within the contest. */
  position: number;
  stage: RoundStage;
  kind: RoundKind;
  status: RoundStatus;
  /** Set by the chief judge before judging. Null until then. Callback rounds only. */
  yesCount: number | null;
  altCount: number | null;
  /** Rough maximum couples per heat, for floor space. Callback rounds only. */
  maxPerHeat: number | null;
  /** Whether the chief judge's scores count as part of the panel. Off by default. */
  chiefJudgeCounts: boolean;
  createdAt: string;
}

export type RoundSettings = Partial<
  Pick<Round, "yesCount" | "altCount" | "maxPerHeat" | "chiefJudgeCounts">
>;

export type DancerRole = "leader" | "follower";

/** Someone signed up for a contest, identified by a bib that is unique within the contest. */
export interface Competitor {
  id: string;
  contestId: string;
  bib: string;
  role: DancerRole;
  /** Optional. Empty when not entered. */
  name: string;
}

export type NewCompetitor = Pick<Competitor, "bib" | "role"> & { name?: string };

export type JudgeAssignment = "leaders" | "followers" | "both";

/** One person on a round's panel. The chief judge always judges both roles. */
export interface RoundJudge {
  id: string;
  roundId: string;
  name: string;
  assignment: JudgeAssignment;
  isChief: boolean;
}

export type NewRoundJudge = Pick<RoundJudge, "name" | "assignment"> & { isChief?: boolean };

/** One dancer's place in a saved heat. */
export interface SavedHeatSlot {
  competitorId: string;
  bib: string;
  redancer: boolean;
}

export interface SavedHeat {
  number: number;
  leaders: SavedHeatSlot[];
  followers: SavedHeatSlot[];
}

export type AccessLinkKind = "judge" | "emcee";

/** A private link as the organiser sees it. The token itself is shown once, when the link is made. */
export interface AccessLinkInfo {
  id: string;
  roundId: string;
  kind: AccessLinkKind;
  /** The judge (or chief judge) the link is for. Null for the emcee link. */
  judgeId: string | null;
  createdAt: string;
}

export type AccessLinkTarget = { kind: "judge"; judgeId: string } | { kind: "emcee" };
