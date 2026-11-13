import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { checkNewStage, kindForStage, type RoundKind, type RoundStage } from "@/core/round-rules";
import { hashAccessToken, newAccessToken } from "@/lib/access-token";
import { heatsToSlots, slotsToHeats, type HeatSlotRecord } from "./heat-slots";
import { checkRoundSettings, cleanBib, cleanContestName, cleanJudgeName, compareBibs } from "./settings";
import { StoreError, type ContestStore } from "./store";
import type { AccessLinkInfo, AccessLinkKind, CallbackResultStatus, Competitor, Contest, FinalCouple, RoundCut, RoundResult, SheetSubmission, DancerRole, JudgeAssignment, Round, RoundJudge, RoundSettings, RoundStatus } from "./types";

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

interface CompetitorRow {
  id: string;
  contest_id: string;
  bib: string;
  role: DancerRole;
  name: string;
}

interface JudgeRow {
  id: string;
  round_id: string;
  name: string;
  assignment: JudgeAssignment;
  is_chief: boolean;
}

interface HeatSlotRow {
  role: DancerRole;
  heat_number: number;
  slot: number;
  competitor_id: string;
  redancer: boolean;
}

interface LinkRow {
  id: string;
  round_id: string;
  kind: AccessLinkKind;
  judge_id: string | null;
  created_at: string;
}

const LINK_COLUMNS = "id, round_id, kind, judge_id, created_at";
const toLink = (row: LinkRow): AccessLinkInfo => ({ id: row.id, roundId: row.round_id, kind: row.kind, judgeId: row.judge_id, createdAt: row.created_at });

const COMPETITOR_COLUMNS = "id, contest_id, bib, role, name";
const JUDGE_COLUMNS = "id, round_id, name, assignment, is_chief";

const toCompetitor = (row: CompetitorRow): Competitor => ({ id: row.id, contestId: row.contest_id, bib: row.bib, role: row.role, name: row.name });
const toJudge = (row: JudgeRow): RoundJudge => ({ id: row.id, roundId: row.round_id, name: row.name, assignment: row.assignment, isChief: row.is_chief });
const toSlotRecord = (row: HeatSlotRow): HeatSlotRecord => ({
  role: row.role,
  heatNumber: row.heat_number,
  slot: row.slot,
  competitorId: row.competitor_id,
  redancer: row.redancer
});

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
    case "P0002": // replace_round_heats: round not found
    case "22P02": // not a valid uuid, so it cannot exist
      return new StoreError("not_found", `${what} not found.`);
    case "23514": // check constraint
    case "23505": // unique constraint, for example two rounds racing for the same position
    case "23502": // not null
      return new StoreError("invalid", error.code === "23505" ? duplicateMessage(error) : error.message);
    default:
      return new Error(`Database error (${error.code}): ${error.message}`);
  }
}

function duplicateMessage(error: PostgrestError): string {
  if (error.message.includes("round_judges_one_chief")) return "This round already has a chief judge.";
  if (error.message.includes("contest_competitors")) return "That bib is already in this contest.";
  return error.message;
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
  const competitorTable = () => client.from("contest_competitors");
  const judgeTable = () => client.from("round_judges");
  const heatTable = () => client.from("round_heat_slots");

  const fetchCompetitors = async (contestId: string) =>
    unwrap(await competitorTable().select(COMPETITOR_COLUMNS).eq("contest_id", contestId).returns<CompetitorRow[]>(), "Competitors")
      .map(toCompetitor)
      .sort((a, b) => compareBibs(a.bib, b.bib));

  const fetchJudge = async (id: string) =>
    toJudge(unwrap(await judgeTable().select(JUDGE_COLUMNS).eq("id", id).single<JudgeRow>(), `Judge ${id}`));

  const fetchHeats = async (round: Round) => {
    const rows = unwrap(
      await heatTable().select("role, heat_number, slot, competitor_id, redancer").eq("round_id", round.id).returns<HeatSlotRow[]>(),
      "Heats"
    );
    return slotsToHeats(rows.map(toSlotRecord), await fetchCompetitors(round.contestId));
  };

  /** Deletes rows matching a filter and reports not_found when nothing was there (or it is not this organiser's). */
  const deleteOne = async (table: "contest_competitors" | "round_judges" | "round_access_links", id: string, what: string) => {
    const { data, error } = await client.from(table).delete().eq("id", id).select("id");
    if (error) throw toStoreError(error, what);
    if (!data || data.length === 0) throw new StoreError("not_found", `${what} not found.`);
  };

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
    },
    async addCompetitors(contestId, list) {
      await fetchContest(contestId);
      const rows = list.map((c) => ({ contest_id: contestId, bib: cleanBib(c.bib), role: c.role, name: (c.name ?? "").trim() }));
      const seen = new Set<string>();
      for (const row of rows) {
        if (seen.has(row.bib)) throw new StoreError("invalid", `Bib ${row.bib} is listed twice.`);
        seen.add(row.bib);
      }
      if (rows.length === 0) return [];
      // Name the clashing bib for the organiser. The unique constraint still guards against a race.
      const taken = new Set((await fetchCompetitors(contestId)).map((c) => c.bib));
      const clash = rows.find((row) => taken.has(row.bib));
      if (clash) throw new StoreError("invalid", `Bib ${clash.bib} is already in this contest.`);
      // One insert is one statement, so a clash on any bib adds none of them.
      const inserted = unwrap(await competitorTable().insert(rows).select(COMPETITOR_COLUMNS).returns<CompetitorRow[]>(), "Competitors");
      return inserted.map(toCompetitor);
    },

    async listCompetitors(contestId) {
      await fetchContest(contestId);
      return fetchCompetitors(contestId);
    },

    async updateCompetitor(id, changes) {
      const before = toCompetitor(unwrap(await competitorTable().select(COMPETITOR_COLUMNS).eq("id", id).single<CompetitorRow>(), `Competitor ${id}`));
      const patch: Partial<CompetitorRow> = {};
      if (changes.bib !== undefined) patch.bib = cleanBib(changes.bib);
      if (changes.role !== undefined) patch.role = changes.role;
      if (changes.name !== undefined) patch.name = changes.name.trim();
      if (Object.keys(patch).length === 0) return before;
      const after = toCompetitor(
        unwrap(await competitorTable().update(patch).eq("id", id).select(COMPETITOR_COLUMNS).single<CompetitorRow>(), `Competitor ${id}`)
      );
      if (after.role !== before.role) {
        // A dancer who changed role no longer belongs in the heats they were saved in.
        const { error } = await heatTable().delete().eq("competitor_id", id);
        if (error) throw toStoreError(error, "Heats");
      }
      return after;
    },

    async removeCompetitor(id) {
      await deleteOne("contest_competitors", id, `Competitor ${id}`);
    },

    async addJudge(roundId, judge) {
      await fetchRound(roundId);
      const isChief = judge.isChief ?? false;
      const row = { round_id: roundId, name: cleanJudgeName(judge.name), assignment: isChief ? "both" : judge.assignment, is_chief: isChief };
      return toJudge(unwrap(await judgeTable().insert(row).select(JUDGE_COLUMNS).single<JudgeRow>(), "Judge"));
    },

    async listJudges(roundId) {
      await fetchRound(roundId);
      const rows = unwrap(
        await judgeTable()
          .select(JUDGE_COLUMNS)
          .eq("round_id", roundId)
          .order("is_chief", { ascending: false })
          .order("created_at")
          .order("id")
          .returns<JudgeRow[]>(),
        "Judges"
      );
      return rows.map(toJudge);
    },

    async updateJudge(id, changes) {
      const judge = await fetchJudge(id);
      const isChief = changes.isChief ?? judge.isChief;
      const patch: Partial<JudgeRow> = { is_chief: isChief, assignment: isChief ? "both" : (changes.assignment ?? judge.assignment) };
      if (changes.name !== undefined) patch.name = cleanJudgeName(changes.name);
      return toJudge(unwrap(await judgeTable().update(patch).eq("id", id).select(JUDGE_COLUMNS).single<JudgeRow>(), `Judge ${id}`));
    },

    async removeJudge(id) {
      await deleteOne("round_judges", id, `Judge ${id}`);
    },

    async saveHeats(roundId, heats) {
      const round = await fetchRound(roundId);
      const slots = heatsToSlots(round, heats, await fetchCompetitors(round.contestId));
      const payload = slots.map((s) => ({ role: s.role, heat_number: s.heatNumber, slot: s.slot, competitor_id: s.competitorId, redancer: s.redancer }));
      const { error } = await client.rpc("replace_round_heats", { target_round: roundId, slots: payload });
      if (error) throw toStoreError(error, `Round ${roundId}`);
      return fetchHeats(round);
    },

    async listHeats(roundId) {
      return fetchHeats(await fetchRound(roundId));
    },

    async createAccessLink(roundId, target) {
      await fetchRound(roundId);
      if (target.kind === "judge") {
        const judge = await fetchJudge(target.judgeId);
        if (judge.roundId !== roundId) throw new StoreError("not_found", `Judge ${target.judgeId} not found.`);
      }
      // Replace the earlier link, so it stops working.
      let old = client.from("round_access_links").delete().eq("round_id", roundId).eq("kind", target.kind);
      old = target.kind === "judge" ? old.eq("judge_id", target.judgeId) : old.is("judge_id", null);
      const removed = await old;
      if (removed.error) throw toStoreError(removed.error, "Link");

      const token = newAccessToken();
      const row = {
        round_id: roundId,
        kind: target.kind,
        judge_id: target.kind === "judge" ? target.judgeId : null,
        token_hash: await hashAccessToken(token)
      };
      const link = toLink(unwrap(await client.from("round_access_links").insert(row).select(LINK_COLUMNS).single<LinkRow>(), "Link"));
      return { token, link };
    },

    async listAccessLinks(roundId) {
      await fetchRound(roundId);
      const rows = unwrap(
        await client.from("round_access_links").select(LINK_COLUMNS).eq("round_id", roundId).order("created_at").returns<LinkRow[]>(),
        "Links"
      );
      return rows.map(toLink);
    },

    async revokeAccessLink(id) {
      await deleteOne("round_access_links", id, `Link ${id}`);
    },

    async listRoundEntries(roundId) {
      const round = await fetchRound(roundId);
      const all = await fetchCompetitors(round.contestId);
      if (round.position === 1) return all;
      const previous = (await fetchRounds(round.contestId)).find((r) => r.position === round.position - 1);
      if (!previous) return all;
      const rows = unwrap(
        await client.from("round_results").select("competitor_id").eq("round_id", previous.id).eq("status", "advancing").returns<{ competitor_id: string }[]>(),
        "Results"
      );
      const advancing = new Set(rows.map((r) => r.competitor_id));
      return all.filter((c) => advancing.has(c.id));
    },

    async listRoundResults(roundId) {
      await fetchRound(roundId);
      const cuts = unwrap(
        await client.from("round_cuts").select("role, cut, alternates, decided_at").eq("round_id", roundId).returns<{ role: DancerRole; cut: number; alternates: number; decided_at: string }[]>(),
        "Cuts"
      ).map((c): RoundCut => ({ role: c.role, cut: c.cut, alternates: c.alternates, decidedAt: c.decided_at }));
      const results = unwrap(
        await client
          .from("round_results")
          .select("competitor_id, role, rank, points_x100, status, alternate_order")
          .eq("round_id", roundId)
          .order("rank")
          .returns<{ competitor_id: string; role: DancerRole; rank: number; points_x100: number; status: CallbackResultStatus; alternate_order: number | null }[]>(),
        "Results"
      ).map((r): RoundResult => ({ competitorId: r.competitor_id, role: r.role, rank: r.rank, pointsX100: r.points_x100, status: r.status, alternateOrder: r.alternate_order }));
      return { cuts, results };
    },

    async listSubmissions(roundId) {
      const round = await fetchRound(roundId);
      if (round.kind === "final") {
        const rows = unwrap(await client.from("final_submissions").select("judge_id, submitted_at").eq("round_id", roundId).returns<{ judge_id: string; submitted_at: string }[]>(), "Submissions");
        return rows.map((r): SheetSubmission => ({ judgeId: r.judge_id, role: null, submittedAt: r.submitted_at }));
      }
      const rows = unwrap(
        await client.from("sheet_submissions").select("judge_id, role, submitted_at").eq("round_id", roundId).returns<{ judge_id: string; role: DancerRole; submitted_at: string }[]>(),
        "Submissions"
      );
      return rows.map((r): SheetSubmission => ({ judgeId: r.judge_id, role: r.role, submittedAt: r.submitted_at }));
    },

    async reopenSheet(roundId, judgeId, role) {
      await fetchRound(roundId);
      const result =
        role === null
          ? await client.from("final_submissions").delete().eq("judge_id", judgeId).eq("round_id", roundId)
          : await client.from("sheet_submissions").delete().eq("judge_id", judgeId).eq("round_id", roundId).eq("role", role);
      if (result.error) throw toStoreError(result.error, "Sheet");
    },

    async saveCouples(roundId, list) {
      const round = await fetchRound(roundId);
      if (round.kind !== "final") throw new StoreError("invalid", "Only a final has couples.");
      const people = new Map((await fetchCompetitors(round.contestId)).map((c) => [c.id, c]));
      const leaders = new Set<string>();
      const followers = new Set<string>();
      for (const pair of list) {
        if (people.get(pair.leaderId)?.role !== "leader" || people.get(pair.followerId)?.role !== "follower") {
          throw new StoreError("invalid", "Each couple needs a leader and a follower from this contest.");
        }
        if (leaders.has(pair.leaderId) || followers.has(pair.followerId)) throw new StoreError("invalid", "Someone is in two couples.");
        leaders.add(pair.leaderId);
        followers.add(pair.followerId);
      }
      const payload = list.map((pair, index) => ({ couple_number: index + 1, leader_id: pair.leaderId, follower_id: pair.followerId }));
      const { error } = await client.rpc("replace_final_couples", { target_round: roundId, couples: payload });
      if (error) throw toStoreError(error, `Round ${roundId}`);
      return this.listCouples(roundId);
    },

    async listCouples(roundId) {
      await fetchRound(roundId);
      const rows = unwrap(
        await client.from("final_couples").select("id, round_id, couple_number, leader_id, follower_id").eq("round_id", roundId).order("couple_number")
          .returns<{ id: string; round_id: string; couple_number: number; leader_id: string; follower_id: string }[]>(),
        "Couples"
      );
      return rows.map((r): FinalCouple => ({ id: r.id, roundId: r.round_id, number: r.couple_number, leaderId: r.leader_id, followerId: r.follower_id }));
    },

    async listFinalScores(roundId) {
      await fetchRound(roundId);
      const rows = unwrap(
        await client.from("final_scores").select("judge_id, couple_id, tenths").eq("round_id", roundId).not("tenths", "is", null)
          .returns<{ judge_id: string; couple_id: string; tenths: number }[]>(),
        "Scores"
      );
      return rows.map((r) => ({ judgeId: r.judge_id, coupleId: r.couple_id, tenths: r.tenths }));
    },

    async savePlacements(roundId, list) {
      await fetchRound(roundId);
      if (new Set(list.map((p) => p.place)).size !== list.length) throw new StoreError("invalid", "Two couples cannot share a place.");
      const removed = await client.from("final_placements").delete().eq("round_id", roundId);
      if (removed.error) throw toStoreError(removed.error, "Placements");
      if (list.length === 0) return;
      const { error } = await client.from("final_placements").insert(list.map((p) => ({ round_id: roundId, couple_id: p.coupleId, place: p.place })));
      if (error) throw toStoreError(error, "Placements");
    },

    async listPlacements(roundId) {
      await fetchRound(roundId);
      const rows = unwrap(
        await client.from("final_placements").select("couple_id, place").eq("round_id", roundId).order("place").returns<{ couple_id: string; place: number }[]>(),
        "Placements"
      );
      return rows.map((r) => ({ coupleId: r.couple_id, place: r.place }));
    }
  };
}
