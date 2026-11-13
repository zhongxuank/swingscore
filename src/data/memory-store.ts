import { checkNewStage, kindForStage, type RoundStage } from "@/core/round-rules";
import { StoreError, type ContestStore } from "./store";
import { checkRoundSettings, cleanBib, cleanContestName, cleanJudgeName, compareBibs } from "./settings";
import { heatsToSlots, slotsToHeats, type HeatSlotRecord } from "./heat-slots";
import { hashAccessToken, newAccessToken } from "@/lib/access-token";
import type { AccessLinkInfo, Competitor, Contest, Round, RoundJudge, RoundSettings } from "./types";

/** In-memory store for tests and offline development. Holds the same rules the database version must hold. */
export function createMemoryStore(now: () => Date = () => new Date()): ContestStore {
  const contests = new Map<string, Contest>();
  const rounds = new Map<string, Round>();
  const competitors = new Map<string, Competitor>();
  const judges = new Map<string, RoundJudge & { order: number }>();
  const heatSlots = new Map<string, HeatSlotRecord[]>();
  const links = new Map<string, AccessLinkInfo & { tokenHash: string }>();
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

  const getRound = (id: string): Round => {
    const round = rounds.get(id);
    if (!round) throw new StoreError("not_found", `Round ${id} not found.`);
    return round;
  };

  const competitorsOf = (contestId: string) =>
    [...competitors.values()].filter((c) => c.contestId === contestId).sort((a, b) => compareBibs(a.bib, b.bib));

  const checkBibFree = (contestId: string, bib: string, exceptId?: string) => {
    if (competitorsOf(contestId).some((c) => c.bib === bib && c.id !== exceptId)) {
      throw new StoreError("invalid", `Bib ${bib} is already in this contest.`);
    }
  };

  const judgesOf = (roundId: string) =>
    [...judges.values()].filter((j) => j.roundId === roundId).sort((a, b) => Number(b.isChief) - Number(a.isChief) || a.order - b.order);

  const publicJudge = ({ order: _order, ...judge }: RoundJudge & { order: number }): RoundJudge => {
    void _order;
    return { ...judge };
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
      const round = getRound(id);

      checkRoundSettings(round, settings);

      const updated: Round = { ...round, ...settings };
      rounds.set(id, updated);
      return { ...updated };
    },

    async addCompetitors(contestId, list) {
      getContest(contestId);
      const cleaned = list.map((c) => ({ bib: cleanBib(c.bib), role: c.role, name: (c.name ?? "").trim() }));
      const seen = new Set<string>();
      for (const c of cleaned) {
        if (seen.has(c.bib)) throw new StoreError("invalid", `Bib ${c.bib} is listed twice.`);
        seen.add(c.bib);
        checkBibFree(contestId, c.bib);
      }
      return cleaned.map((c) => {
        const competitor: Competitor = { id: nextId("competitor"), contestId, ...c };
        competitors.set(competitor.id, competitor);
        return { ...competitor };
      });
    },

    async listCompetitors(contestId) {
      getContest(contestId);
      return competitorsOf(contestId).map((c) => ({ ...c }));
    },

    async updateCompetitor(id, changes) {
      const competitor = competitors.get(id);
      if (!competitor) throw new StoreError("not_found", `Competitor ${id} not found.`);
      const updated = { ...competitor };
      if (changes.bib !== undefined) {
        updated.bib = cleanBib(changes.bib);
        checkBibFree(competitor.contestId, updated.bib, id);
      }
      if (changes.role !== undefined) updated.role = changes.role;
      if (changes.name !== undefined) updated.name = changes.name.trim();
      competitors.set(id, updated);
      if (updated.role !== competitor.role) {
        for (const [roundId, slots] of heatSlots) heatSlots.set(roundId, slots.filter((slot) => slot.competitorId !== id));
      }
      return { ...updated };
    },

    async removeCompetitor(id) {
      if (!competitors.delete(id)) throw new StoreError("not_found", `Competitor ${id} not found.`);
      for (const [roundId, slots] of heatSlots) heatSlots.set(roundId, slots.filter((slot) => slot.competitorId !== id));
    },

    async addJudge(roundId, judge) {
      getRound(roundId);
      const isChief = judge.isChief ?? false;
      if (isChief && judgesOf(roundId).some((j) => j.isChief)) throw new StoreError("invalid", "This round already has a chief judge.");
      const added = {
        id: nextId("judge"),
        roundId,
        name: cleanJudgeName(judge.name),
        assignment: isChief ? ("both" as const) : judge.assignment,
        isChief,
        order: (counter += 1)
      };
      judges.set(added.id, added);
      return publicJudge(added);
    },

    async listJudges(roundId) {
      getRound(roundId);
      return judgesOf(roundId).map(publicJudge);
    },

    async updateJudge(id, changes) {
      const judge = judges.get(id);
      if (!judge) throw new StoreError("not_found", `Judge ${id} not found.`);
      const isChief = changes.isChief ?? judge.isChief;
      if (isChief && !judge.isChief && judgesOf(judge.roundId).some((j) => j.isChief)) {
        throw new StoreError("invalid", "This round already has a chief judge.");
      }
      const updated = {
        ...judge,
        name: changes.name !== undefined ? cleanJudgeName(changes.name) : judge.name,
        isChief,
        assignment: isChief ? ("both" as const) : (changes.assignment ?? judge.assignment)
      };
      judges.set(id, updated);
      return publicJudge(updated);
    },

    async removeJudge(id) {
      if (!judges.delete(id)) throw new StoreError("not_found", `Judge ${id} not found.`);
    },

    async saveHeats(roundId, heats) {
      const round = getRound(roundId);
      const slots = heatsToSlots(round, heats, competitorsOf(round.contestId));
      heatSlots.set(roundId, slots);
      return slotsToHeats(slots, competitorsOf(round.contestId));
    },

    async listHeats(roundId) {
      const round = getRound(roundId);
      return slotsToHeats(heatSlots.get(roundId) ?? [], competitorsOf(round.contestId));
    },

    async createAccessLink(roundId, target) {
      getRound(roundId);
      if (target.kind === "judge") {
        const judge = judges.get(target.judgeId);
        if (!judge || judge.roundId !== roundId) throw new StoreError("not_found", `Judge ${target.judgeId} not found.`);
      }
      const judgeId = target.kind === "judge" ? target.judgeId : null;
      for (const [id, link] of links) {
        if (link.roundId === roundId && link.kind === target.kind && link.judgeId === judgeId) links.delete(id);
      }
      const token = newAccessToken();
      const link = { id: nextId("link"), roundId, kind: target.kind, judgeId, createdAt: stamp(), tokenHash: await hashAccessToken(token) };
      links.set(link.id, link);
      const { tokenHash: _hash, ...info } = link;
      void _hash;
      return { token, link: info };
    },

    async listAccessLinks(roundId) {
      getRound(roundId);
      return [...links.values()]
        .filter((link) => link.roundId === roundId && (link.judgeId === null || judges.has(link.judgeId)))
        .map(({ tokenHash: _hash, ...info }) => {
          void _hash;
          return info;
        });
    },

    async revokeAccessLink(id) {
      if (!links.delete(id)) throw new StoreError("not_found", `Link ${id} not found.`);
    }
  };
}
