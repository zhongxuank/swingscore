import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { checkNewStage, kindForStage, type RoundKind, type RoundStage } from "@/core/round-rules";
import { checkRoundSettings, cleanContestName } from "./settings";
import { StoreError, type ContestStore } from "./store";
import type { Contest, Round, RoundSettings, RoundStatus } from "./types";

interface ContestRow {
  id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
}

interface RoundRow {
  id: string;
  contest_id: string;
  position: number;
  stage: RoundStage;
  kind: RoundKind;
  status: RoundStatus;
  yes_count: number | null;
  alt_count: number | null;
  max_per_heat: number | null;
  chief_judge_counts: boolean;
  created_at: string;
}

const CONTEST_COLUMNS = "id, name, created_at, archived_at";
const ROUND_COLUMNS =
  "id, contest_id, position, stage, kind, status, yes_count, alt_count, max_per_heat, chief_judge_counts, created_at";

const toContest = (row: ContestRow): Contest => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  archivedAt: row.archived_at
});

const toRound = (row: RoundRow): Round => ({
  id: row.id,
  contestId: row.contest_id,
  position: row.position,
  stage: row.stage,
  kind: row.kind,
  status: row.status,
  yesCount: row.yes_count,
  altCount: row.alt_count,
  maxPerHeat: row.max_per_heat,
  chiefJudgeCounts: row.chief_judge_counts,
  createdAt: row.created_at
});

/** Turns a database error into a StoreError, so screens see the same codes as with the in-memory store. */
function toStoreError(error: PostgrestError, what: string): Error {
  switch (error.code) {
    case "PGRST116": // .single() found no row, including rows hidden by row-level security
    case "22P02": // not a valid uuid, so it cannot exist
      return new StoreError("not_found", `${what} not found.`);
    case "23514": // check constraint
    case "23505": // unique constraint, for example two rounds racing for the same position
    case "23502": // not null
      return new StoreError("invalid", error.message);
    default:
      return new Error(`Database error (${error.code}): ${error.message}`);
  }
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error) throw toStoreError(result.error, what);
  if (result.data === null) throw new StoreError("not_found", `${what} not found.`);
  return result.data;
}

/**
 * ContestStore backed by Supabase. The client must be signed in as the organiser; row-level security
 * limits every query to that organiser's contests, so another organiser's contest reads as not_found.
 */
export function createSupabaseStore(client: SupabaseClient): ContestStore {
  const contests = () => client.from("contests");
  const rounds = () => client.from("rounds");

  const fetchContest = async (id: string) =>
    toContest(unwrap(await contests().select(CONTEST_COLUMNS).eq("id", id).single<ContestRow>(), `Contest ${id}`));

  const updateContest = async (id: string, patch: Partial<ContestRow>) =>
    toContest(unwrap(await contests().update(patch).eq("id", id).select(CONTEST_COLUMNS).single<ContestRow>(), `Contest ${id}`));

  const fetchRound = async (id: string) =>
    toRound(unwrap(await rounds().select(ROUND_COLUMNS).eq("id", id).single<RoundRow>(), `Round ${id}`));

  const fetchRounds = async (contestId: string) =>
    unwrap(await rounds().select(ROUND_COLUMNS).eq("contest_id", contestId).order("position").returns<RoundRow[]>(), "Rounds").map(toRound);

  return {
    async createContest(name) {
      const row = unwrap(await contests().insert({ name: cleanContestName(name) }).select(CONTEST_COLUMNS).single<ContestRow>(), "Contest");
      return toContest(row);
    },

    getContest: fetchContest,

    async listContests({ includeArchived = false } = {}) {
      let query = contests().select(CONTEST_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false });
      if (!includeArchived) query = query.is("archived_at", null);
      return unwrap(await query.returns<ContestRow[]>(), "Contests").map(toContest);
    },

    async renameContest(id, name) {
      return updateContest(id, { name: cleanContestName(name) });
    },

    async archiveContest(id) {
      const contest = await fetchContest(id);
      if (contest.archivedAt) return contest;
      return updateContest(id, { archived_at: new Date().toISOString() });
    },

    async restoreContest(id) {
      return updateContest(id, { archived_at: null });
    },

    async addRound(contestId, stage) {
      await fetchContest(contestId);
      const existing = await fetchRounds(contestId);
      const problem = checkNewStage(existing.map((round) => round.stage), stage);
      if (problem) throw new StoreError("invalid", problem);

      const row = unwrap(
        await rounds()
          .insert({ contest_id: contestId, position: existing.length + 1, stage, kind: kindForStage(stage) })
          .select(ROUND_COLUMNS)
          .single<RoundRow>(),
        "Round"
      );
      return toRound(row);
    },

    async listRounds(contestId) {
      await fetchContest(contestId);
      return fetchRounds(contestId);
    },

    getRound: fetchRound,

    async updateRoundSettings(id, settings: RoundSettings) {
      const round = await fetchRound(id);
      checkRoundSettings(round, settings);

      const patch: Partial<RoundRow> = {};
      if (settings.yesCount !== undefined) patch.yes_count = settings.yesCount;
      if (settings.altCount !== undefined) patch.alt_count = settings.altCount;
      if (settings.maxPerHeat !== undefined) patch.max_per_heat = settings.maxPerHeat;
      if (settings.chiefJudgeCounts !== undefined) patch.chief_judge_counts = settings.chiefJudgeCounts;
      if (Object.keys(patch).length === 0) return round;

      return toRound(unwrap(await rounds().update(patch).eq("id", id).select(ROUND_COLUMNS).single<RoundRow>(), `Round ${id}`));
    }
  };
}
