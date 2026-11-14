import type { RoundKind, RoundStage } from "@/core/round-rules";
import type { AccessLinkKind, DancerRole, JudgeAssignment, RoundStatus } from "./types";

/** Everything a private link may see. Judges get bibs only and their own scores; the emcee gets names and no scores. */
export interface AccessView {
  kind: AccessLinkKind;
  contest: { id: string; name: string };
  round: {
    id: string;
    stage: RoundStage;
    kind: RoundKind;
    status: RoundStatus;
    position: number;
    yesCount: number | null;
    altCount: number | null;
    maxPerHeat: number | null;
    chiefJudgeCounts: boolean;
  };
  judge: { id: string; name: string; assignment: JudgeAssignment; isChief: boolean } | null;
  /** The roles this link covers. */
  roles: DancerRole[];
  competitors: Array<{ id: string; bib: string; role: DancerRole; name: string }>;
  heats: Array<{ role: DancerRole; heatNumber: number; slot: number; competitorId: string; redancer: boolean }>;
  scores: Array<{ competitorId: string; tenths: number; clientAt: string }>;
  submitted: DancerRole[];
  /** Final rounds: couples in floor order. */
  couples: Array<{ id: string; number: number; leaderId: string; followerId: string }>;
  /** Final rounds: this judge's own scores. */
  finalScores: Array<{ coupleId: string; tenths: number; clientAt: string }>;
  finalSubmitted: boolean;
  /** Emcee only: stored callback results and finals placements. Empty until decided. */
  cuts: Array<{ role: DancerRole; cut: number; alternates: number }>;
  results: Array<{ competitorId: string; role: DancerRole; rank: number; status: CallbackStatus; alternateOrder: number | null }>;
  placements: Array<{ coupleId: string; place: number }>;
}

export type CallbackStatus = "advancing" | "alternate" | "out";

/** What the chief judge loads to combine a callback round. */
export interface RoundScores {
  judges: Array<{ id: string; name: string; assignment: JudgeAssignment; isChief: boolean }>;
  submissions: Array<{ judgeId: string; role: DancerRole }>;
  scores: Array<{ judgeId: string; competitorId: string; tenths: number }>;
  cuts: Array<{ role: DancerRole; cut: number; alternates: number; decidedAt: string }>;
}

export interface CutResultRow {
  competitorId: string;
  rank: number;
  pointsX100: number;
  status: CallbackStatus;
  alternateOrder: number | null;
}

/** What a private link can do. Every call carries the raw token; the database checks it each time. */
export interface AccessStore {
  /** Null when the token is wrong, edited or revoked. */
  load(token: string): Promise<AccessView | null>;
  /**
   * Saves or clears (null) one score. `changedAt` is when the judge made the change on the phone, so a late
   * retry never overwrites a newer score. Throws StoreError for a change the database refuses for good;
   * any other error (for example no connection) is worth retrying.
   */
  saveScore(token: string, competitorId: string, tenths: number | null, changedAt: string): Promise<void>;
  submitSheet(token: string, role: DancerRole): Promise<void>;

  /** Chief judge only. */
  setCallbackCounts(token: string, yes: number, alternates: number): Promise<void>;
  /** Chief judge only. Null for any other link. */
  loadRoundScores(token: string): Promise<RoundScores | null>;
  /** Chief judge only. Stores the combined ranking for one role and the cut. */
  decideCut(token: string, role: DancerRole, cut: number, alternates: number, results: CutResultRow[]): Promise<void>;

  /** Final rounds: same rules as saveScore, for a couple. */
  saveFinalScore(token: string, coupleId: string, tenths: number | null, changedAt: string): Promise<void>;
  submitFinalSheet(token: string): Promise<void>;
}
