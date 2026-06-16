export type Role = "Leader" | "Follower";

export type CompetitionKind = "contest";

export type RoundStage = "prelim" | "quarter_final" | "semi_final" | "final";

export type ScoringMethod = "callback" | "relative_placement";

export type RoundStatus = "draft" | "running" | "finalized";

export type AccessRole = "admin" | "judge" | "chief" | "emcee";

export type JudgeAssignmentRole = "leaders" | "followers" | "both";

export type ChiefJudgeMode = "none" | "tiebreak_only" | "full_panel";

export type SaveState = "saved" | "saving" | "offline" | "reconnecting";

export interface Competition {
  id: string;
  name: string;
  division: string;
  kind: CompetitionKind;
  status: "draft" | "running" | "finalized";
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
  sourceCompetitionId?: string;
}

export type Contest = Competition;

export interface RoundConfig {
  id: string;
  competitionId: string;
  name: string;
  stage: RoundStage;
  scoringMethod: ScoringMethod;
  status: RoundStatus;
  order: number;
  requiredYeses: number;
  requiredAlts: number;
  advancementCount: number;
  leaderChiefJudgeMode: ChiefJudgeMode;
  followerChiefJudgeMode: ChiefJudgeMode;
  chiefJudgeCountsForFinal?: boolean;
  sourceRoundId?: string;
  startedAt?: string;
  setupLockedAt?: string;
  finalizedAt?: string;
  judgePanelConfirmedAt?: string;
  setupSnapshot?: Record<string, unknown>;
}

export interface Competitor {
  id: string;
  bibNumber: string;
  preferredName: string;
  role: Role;
  legalFirstName?: string;
  legalLastName?: string;
  isFiller?: boolean;
}

export interface Judge {
  id: string;
  name: string;
  roleAssignment: JudgeAssignmentRole;
  isChiefJudge?: boolean;
}

export interface HeatEntry {
  id: string;
  roundId: string;
  heatNumber: number;
  competitorId: string;
  role: Role;
  partnerCompetitorId?: string;
  isFiller: boolean;
}

export interface RawScore {
  judgeId: string;
  subjectId: string;
  scoreX2: number;
  role?: Role;
  isChiefJudge?: boolean;
}

export interface Couple {
  id: string;
  leaderId: string;
  followerId?: string;
  danceOrder: number;
}

export interface AccessLink {
  token: string;
  role: AccessRole;
  label: string;
  href: string;
}

export interface ScoreDraft {
  subjectId: string;
  scoreX2: number;
}

export interface AlternatePointProfile {
  yes: number;
  alt1: number;
  alt2: number;
  alt3: number;
  no: number;
}

export interface PrelimJudgeMark {
  competitorId: string;
  scoreX2: number;
  rank: number;
  status: "yes" | "alt" | "no";
  altLevel?: 1 | 2 | 3;
  points: number;
}

export interface BoundaryTie {
  kind: "yes" | "alternate" | "advancement" | "placement";
  role?: Role;
  boundary: number;
  subjectIds: string[];
  score?: number;
  points?: number;
  resolvedByChiefJudge?: boolean;
}

export interface AdvancementRow {
  competitorId: string;
  role: Role;
  totalPoints: number;
  rank: number;
  status: "advancing" | "alternate" | "out";
  chiefJudgeScoreX2?: number;
}

export interface FinalPlacementRow {
  coupleId: string;
  placement: number;
  majorityAt: number;
  majorityCount: number;
  ordinalSum: number;
}
