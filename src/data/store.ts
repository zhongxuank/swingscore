import type { RoundStage } from "@/core/round-rules";
import type { Heat } from "@/core/heats";
import type {
  FinalCouple,
  FinalPlacement,
  FinalScoreRow,
  RoundCut,
  RoundResult,
  SheetSubmission,
  AccessLinkInfo,
  AccessLinkTarget,
  Competitor,
  Contest,
  NewCompetitor,
  NewRoundJudge,
  Round,
  RoundJudge,
  RoundSettings,
  SavedHeat,
  DancerRole
} from "./types";

export type StoreErrorCode = "not_found" | "invalid";

export class StoreError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = "StoreError";
  }
}

/**
 * The one place screens read and write contests and rounds. A Supabase version and an in-memory
 * version both satisfy this and run the same contract tests.
 */
export interface ContestStore {
  createContest(name: string): Promise<Contest>;
  getContest(id: string): Promise<Contest>;
  listContests(options?: { includeArchived?: boolean }): Promise<Contest[]>;
  renameContest(id: string, name: string): Promise<Contest>;
  archiveContest(id: string): Promise<Contest>;
  restoreContest(id: string): Promise<Contest>;

  /** Adds a round after the existing ones. Rejects a stage that is out of order. */
  addRound(contestId: string, stage: RoundStage): Promise<Round>;
  listRounds(contestId: string): Promise<Round[]>;
  getRound(id: string): Promise<Round>;
  updateRoundSettings(id: string, settings: RoundSettings): Promise<Round>;

  /** Adds several competitors at once, all or none. Rejects a bib already in the contest or repeated in the list. */
  addCompetitors(contestId: string, competitors: NewCompetitor[]): Promise<Competitor[]>;
  /** In bib order (numeric where bibs are numbers). */
  listCompetitors(contestId: string): Promise<Competitor[]>;
  updateCompetitor(id: string, changes: Partial<NewCompetitor>): Promise<Competitor>;
  /** Also removes the competitor from any saved heats. */
  removeCompetitor(id: string): Promise<void>;

  /** Rejects a second chief judge. A chief judge always judges both roles. */
  addJudge(roundId: string, judge: NewRoundJudge): Promise<RoundJudge>;
  /** Chief judge first, then in the order added. */
  listJudges(roundId: string): Promise<RoundJudge[]>;
  updateJudge(id: string, changes: Partial<NewRoundJudge>): Promise<RoundJudge>;
  removeJudge(id: string): Promise<void>;

  /** Replaces a callback round's heats in one step. Every bib must be a competitor of the contest in that role. */
  saveHeats(roundId: string, heats: Heat[]): Promise<SavedHeat[]>;
  /** The saved heats, or an empty list when none are saved. */
  listHeats(roundId: string): Promise<SavedHeat[]>;

  /**
   * Makes a private link for a judge (or chief judge) or the round's emcee, replacing any earlier one, which then
   * stops working. Returns the raw token, which is not stored and cannot be read back later.
   */
  createAccessLink(roundId: string, target: AccessLinkTarget): Promise<{ token: string; link: AccessLinkInfo }>;
  listAccessLinks(roundId: string): Promise<AccessLinkInfo[]>;
  /** Stops a link working. */
  revokeAccessLink(id: string): Promise<void>;

  /**
   * Who dances in a round: everyone in the contest for the first round, otherwise those the chief judge sent
   * through from the round before (empty until that cut is decided). Bib order.
   */
  listRoundEntries(roundId: string): Promise<Competitor[]>;
  /** The chief judge's stored cuts and combined ranking for a callback round. */
  listRoundResults(roundId: string): Promise<{ cuts: RoundCut[]; results: RoundResult[] }>;
  /** Which judges have submitted which sheets. */
  listSubmissions(roundId: string): Promise<SheetSubmission[]>;
  /** Reopens a submitted sheet so the judge can change it. `role` null reopens a final sheet. */
  reopenSheet(roundId: string, judgeId: string, role: DancerRole | null): Promise<void>;

  /** Replaces a final's couples, numbered in the order given. Refused once any final score is saved. */
  saveCouples(roundId: string, couples: Array<{ leaderId: string; followerId: string }>): Promise<FinalCouple[]>;
  listCouples(roundId: string): Promise<FinalCouple[]>;
  listFinalScores(roundId: string): Promise<FinalScoreRow[]>;
  /** Replaces the published placements of a final. */
  savePlacements(roundId: string, placements: FinalPlacement[]): Promise<void>;
  listPlacements(roundId: string): Promise<FinalPlacement[]>;
}
