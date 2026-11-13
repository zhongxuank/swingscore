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
}
