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
