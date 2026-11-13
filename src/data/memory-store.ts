import { checkNewStage, kindForStage, type RoundStage } from "@/core/round-rules";
import { StoreError, type ContestStore } from "./store";
import { checkRoundSettings, cleanContestName } from "./settings";
import type { Contest, Round, RoundSettings } from "./types";

/** In-memory store for tests and offline development. Holds the same rules the database version must hold. */
export function createMemoryStore(now: () => Date = () => new Date()): ContestStore {
  const contests = new Map<string, Contest>();
  const rounds = new Map<string, Round>();
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;
  const stamp = () => now().toISOString();

  const getContest = (id: string): Contest => {
    const contest = contests.get(id);
    if (!contest) throw new StoreError("not_found", `Contest ${id} not found.`);
    return contest;
  };

  const cleanName = cleanContestName;

  const save = (contest: Contest): Contest => {
    contests.set(contest.id, contest);
    return { ...contest };
  };

  const roundsOf = (contestId: string) =>
    [...rounds.values()].filter((round) => round.contestId === contestId).sort((a, b) => a.position - b.position);

  return {
    async createContest(name) {
      const contest: Contest = { id: nextId("contest"), name: cleanName(name), createdAt: stamp(), archivedAt: null };
      return save(contest);
    },

    async getContest(id) {
      return { ...getContest(id) };
    },

    async listContests({ includeArchived = false } = {}) {
      return [...contests.values()]
        .filter((contest) => includeArchived || contest.archivedAt === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .map((contest) => ({ ...contest }));
    },

    async renameContest(id, name) {
      return save({ ...getContest(id), name: cleanName(name) });
    },

    async archiveContest(id) {
      const contest = getContest(id);
      return save({ ...contest, archivedAt: contest.archivedAt ?? stamp() });
    },

    async restoreContest(id) {
      return save({ ...getContest(id), archivedAt: null });
    },

    async addRound(contestId, stage: RoundStage) {
      getContest(contestId);
      const existing = roundsOf(contestId);
      const problem = checkNewStage(existing.map((round) => round.stage), stage);
      if (problem) throw new StoreError("invalid", problem);

      const round: Round = {
        id: nextId("round"),
        contestId,
        position: existing.length + 1,
        stage,
        kind: kindForStage(stage),
        status: "setup",
        yesCount: null,
        altCount: null,
        maxPerHeat: null,
        chiefJudgeCounts: false,
        createdAt: stamp()
      };
      rounds.set(round.id, round);
      return { ...round };
    },

    async listRounds(contestId) {
      getContest(contestId);
      return roundsOf(contestId).map((round) => ({ ...round }));
    },

    async getRound(id) {
      const round = rounds.get(id);
      if (!round) throw new StoreError("not_found", `Round ${id} not found.`);
      return { ...round };
    },

    async updateRoundSettings(id, settings: RoundSettings) {
      const round = rounds.get(id);
      if (!round) throw new StoreError("not_found", `Round ${id} not found.`);

      checkRoundSettings(round, settings);

      const updated: Round = { ...round, ...settings };
      rounds.set(id, updated);
      return { ...updated };
    }
  };
}
