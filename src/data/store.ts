import type { RoundStage } from "@/core/round-rules";
import type { Contest, Round, RoundSettings } from "./types";

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
}
