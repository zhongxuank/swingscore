import { describe, expect, it } from "vitest";
import { buildHeats } from "@/core/heats";
import { StoreError, type ContestStore } from "./store";

/** Every ContestStore must pass this. The in-memory store runs it now, the Supabase store runs it against a real database. */
export function runContestStoreContract(name: string, makeStore: () => Promise<ContestStore> | ContestStore) {
  describe(`${name} contest store contract`, () => {
    it("creates a contest with a trimmed name and lists it", async () => {
      const store = await makeStore();
      const contest = await store.createContest("  Novice Jack & Jill  ");
      expect(contest).toMatchObject({ name: "Novice Jack & Jill", archivedAt: null });
      expect(await store.listContests()).toEqual([contest]);
      expect(await store.getContest(contest.id)).toEqual(contest);
    });

    it("rejects a blank contest name", async () => {
      const store = await makeStore();
      await expect(store.createContest("   ")).rejects.toMatchObject({ code: "invalid" });
    });

    it("renames, archives and restores without deleting", async () => {
      const store = await makeStore();
      const { id } = await store.createContest("Novice");
      expect((await store.renameContest(id, "Novice J&J")).name).toBe("Novice J&J");

      const archived = await store.archiveContest(id);
      expect(archived.archivedAt).not.toBeNull();
      expect(await store.listContests()).toEqual([]);
      expect(await store.listContests({ includeArchived: true })).toHaveLength(1);

      expect((await store.restoreContest(id)).archivedAt).toBeNull();
      expect(await store.listContests()).toHaveLength(1);
    });

    it("reports a missing contest as not_found", async () => {
      const store = await makeStore();
      await expect(store.getContest("missing")).rejects.toBeInstanceOf(StoreError);
      await expect(store.getContest("missing")).rejects.toMatchObject({ code: "not_found" });
    });

    it("adds rounds in order with the right kind and defaults", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const prelim = await store.addRound(contest.id, "prelim");
      const final = await store.addRound(contest.id, "final");

      expect(prelim).toMatchObject({
        position: 1,
        kind: "callback",
        status: "setup",
        yesCount: null,
        altCount: null,
        maxPerHeat: null,
        chiefJudgeCounts: false
      });
      expect(final).toMatchObject({ position: 2, kind: "final" });
      expect((await store.listRounds(contest.id)).map((round) => round.stage)).toEqual(["prelim", "final"]);
    });

    it("rejects a round out of order and any round after the final", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      await store.addRound(contest.id, "semi_final");
      await expect(store.addRound(contest.id, "prelim")).rejects.toMatchObject({ code: "invalid" });
      await store.addRound(contest.id, "final");
      await expect(store.addRound(contest.id, "final")).rejects.toMatchObject({ code: "invalid" });
    });

    it("keeps settings changes across a reload", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const round = await store.addRound(contest.id, "prelim");
      await store.updateRoundSettings(round.id, { yesCount: 9, altCount: 3, maxPerHeat: 20, chiefJudgeCounts: true });
      expect(await store.getRound(round.id)).toMatchObject({ yesCount: 9, altCount: 3, maxPerHeat: 20, chiefJudgeCounts: true });
    });

    it("rejects invalid settings and callback-only settings on a final", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const prelim = await store.addRound(contest.id, "prelim");
      const final = await store.addRound(contest.id, "final");
      await expect(store.updateRoundSettings(prelim.id, { yesCount: -1 })).rejects.toMatchObject({ code: "invalid" });
      await expect(store.updateRoundSettings(prelim.id, { maxPerHeat: 0 })).rejects.toMatchObject({ code: "invalid" });
      await expect(store.updateRoundSettings(final.id, { yesCount: 5 })).rejects.toMatchObject({ code: "invalid" });
      await expect(store.updateRoundSettings(final.id, { chiefJudgeCounts: true })).resolves.toMatchObject({ chiefJudgeCounts: true });
    });
    it("adds competitors in bulk, lists them in bib order and edits them", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      await store.addCompetitors(contest.id, [
        { bib: "10", role: "leader", name: " Ann " },
        { bib: " 9 ", role: "leader" },
        { bib: "200", role: "follower", name: "Bo" }
      ]);
      const listed = await store.listCompetitors(contest.id);
      expect(listed.map((c) => [c.bib, c.role, c.name])).toEqual([
        ["9", "leader", ""],
        ["10", "leader", "Ann"],
        ["200", "follower", "Bo"]
      ]);

      const updated = await store.updateCompetitor(listed[0].id, { bib: "11", name: "Cy" });
      expect(updated).toMatchObject({ bib: "11", name: "Cy", role: "leader" });
      await store.removeCompetitor(listed[1].id);
      expect((await store.listCompetitors(contest.id)).map((c) => c.bib)).toEqual(["11", "200"]);
    });

    it("rejects duplicate or invalid bibs and adds nothing from a bad batch", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      await store.addCompetitors(contest.id, [{ bib: "1", role: "leader" }]);
      await expect(store.addCompetitors(contest.id, [{ bib: "2", role: "leader" }, { bib: "1", role: "follower" }])).rejects.toMatchObject({ code: "invalid" });
      await expect(store.addCompetitors(contest.id, [{ bib: "3", role: "leader" }, { bib: "3", role: "follower" }])).rejects.toMatchObject({ code: "invalid" });
      await expect(store.addCompetitors(contest.id, [{ bib: "4 4", role: "leader" }])).rejects.toMatchObject({ code: "invalid" });
      expect((await store.listCompetitors(contest.id)).map((c) => c.bib)).toEqual(["1"]);

      const [two] = await store.addCompetitors(contest.id, [{ bib: "2", role: "follower" }]);
      await expect(store.updateCompetitor(two.id, { bib: "1" })).rejects.toMatchObject({ code: "invalid" });
    });

    it("keeps a round panel with one chief judge who judges both roles", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const round = await store.addRound(contest.id, "prelim");
      await store.addJudge(round.id, { name: "Lee", assignment: "leaders" });
      const chief = await store.addJudge(round.id, { name: " Cat ", assignment: "leaders", isChief: true });
      expect(chief).toMatchObject({ name: "Cat", assignment: "both", isChief: true });
      await expect(store.addJudge(round.id, { name: "Two", assignment: "both", isChief: true })).rejects.toMatchObject({ code: "invalid" });
      await expect(store.addJudge(round.id, { name: "  ", assignment: "followers" })).rejects.toMatchObject({ code: "invalid" });

      const fay = await store.addJudge(round.id, { name: "Fay", assignment: "followers" });
      expect((await store.listJudges(round.id)).map((j) => j.name)).toEqual(["Cat", "Lee", "Fay"]);

      expect(await store.updateJudge(fay.id, { assignment: "both" })).toMatchObject({ assignment: "both" });
      await store.removeJudge(chief.id);
      expect((await store.listJudges(round.id)).map((j) => j.name)).toEqual(["Lee", "Fay"]);
    });

    it("saves heats with redancers, replaces them, and drops a removed competitor", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const round = await store.addRound(contest.id, "prelim");
      await store.addCompetitors(contest.id, [
        ...["1", "2", "3"].map((bib) => ({ bib, role: "leader" as const })),
        ...["101", "102"].map((bib) => ({ bib, role: "follower" as const }))
      ]);
      expect(await store.listHeats(round.id)).toEqual([]);

      const heats = buildHeats({ leaders: ["1", "2", "3"], followers: ["101", "102"], maxPerHeat: 2 });
      const saved = await store.saveHeats(round.id, heats);
      const shape = (list: typeof saved) =>
        list.map((heat) => ({
          number: heat.number,
          leaders: heat.leaders.map((s) => `${s.bib}${s.redancer ? "*" : ""}`),
          followers: heat.followers.map((s) => `${s.bib}${s.redancer ? "*" : ""}`)
        }));
      expect(shape(saved)).toEqual([
        { number: 1, leaders: ["1", "2"], followers: ["101", "102"] },
        { number: 2, leaders: ["3", "1*"], followers: ["101*", "102*"] }
      ]);
      expect(shape(await store.listHeats(round.id))).toEqual(shape(saved));

      await store.saveHeats(round.id, buildHeats({ leaders: ["1", "2", "3"], followers: ["101", "102"], maxPerHeat: 3 }));
      expect(await store.listHeats(round.id)).toHaveLength(1);

      const three = (await store.listCompetitors(contest.id)).find((c) => c.bib === "3")!;
      await store.removeCompetitor(three.id);
      expect((await store.listHeats(round.id))[0].leaders.map((s) => s.bib)).toEqual(["1", "2"]);
    });

    it("rejects heats with an unknown bib or a dancer in the wrong role, keeping the old heats", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const round = await store.addRound(contest.id, "prelim");
      const final = await store.addRound(contest.id, "final");
      await store.addCompetitors(contest.id, [{ bib: "1", role: "leader" }, { bib: "101", role: "follower" }]);
      await store.saveHeats(round.id, buildHeats({ leaders: ["1"], followers: ["101"], maxPerHeat: 5 }));

      await expect(store.saveHeats(round.id, buildHeats({ leaders: ["1", "7"], followers: ["101"], maxPerHeat: 5 }))).rejects.toMatchObject({ code: "invalid" });
      await expect(store.saveHeats(round.id, buildHeats({ leaders: ["101"], followers: ["1"], maxPerHeat: 5 }))).rejects.toMatchObject({ code: "invalid" });
      await expect(store.saveHeats(final.id, buildHeats({ leaders: ["1"], followers: ["101"], maxPerHeat: 5 }))).rejects.toMatchObject({ code: "invalid" });
      expect((await store.listHeats(round.id))[0].leaders.map((s) => s.bib)).toEqual(["1"]);
    });
    it("makes private links that replace earlier ones and can be revoked", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const round = await store.addRound(contest.id, "prelim");
      const lee = await store.addJudge(round.id, { name: "Lee", assignment: "leaders" });

      const first = await store.createAccessLink(round.id, { kind: "judge", judgeId: lee.id });
      expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(first.link).toMatchObject({ kind: "judge", judgeId: lee.id, roundId: round.id });
      const second = await store.createAccessLink(round.id, { kind: "judge", judgeId: lee.id });
      expect(second.token).not.toBe(first.token);
      const emcee = await store.createAccessLink(round.id, { kind: "emcee" });
      expect(emcee.link.judgeId).toBeNull();

      const listed = await store.listAccessLinks(round.id);
      expect(listed.map((link) => link.id).sort()).toEqual([second.link.id, emcee.link.id].sort());
      expect(JSON.stringify(listed)).not.toContain(second.token);

      await store.revokeAccessLink(emcee.link.id);
      expect(await store.listAccessLinks(round.id)).toHaveLength(1);
      await store.removeJudge(lee.id);
      expect(await store.listAccessLinks(round.id)).toEqual([]);
    });
    it("lists round entries, saves final couples in order and publishes placements", async () => {
      const store = await makeStore();
      const contest = await store.createContest("Novice");
      const prelim = await store.addRound(contest.id, "prelim");
      const final = await store.addRound(contest.id, "final");
      await store.addCompetitors(contest.id, [
        { bib: "2", role: "leader" },
        { bib: "1", role: "leader" },
        { bib: "101", role: "follower" },
        { bib: "102", role: "follower" }
      ]);
      expect((await store.listRoundEntries(prelim.id)).map((c) => c.bib)).toEqual(["1", "2", "101", "102"]);
      expect(await store.listRoundEntries(final.id)).toEqual([]);
      expect(await store.listRoundResults(prelim.id)).toEqual({ cuts: [], results: [] });
      expect(await store.listSubmissions(prelim.id)).toEqual([]);

      const people = new Map((await store.listCompetitors(contest.id)).map((c) => [c.bib, c.id]));
      const couples = await store.saveCouples(final.id, [
        { leaderId: people.get("2")!, followerId: people.get("101")! },
        { leaderId: people.get("1")!, followerId: people.get("102")! }
      ]);
      expect(couples.map((c) => c.number)).toEqual([1, 2]);
      expect((await store.listCouples(final.id)).map((c) => c.leaderId)).toEqual([people.get("2"), people.get("1")]);
      await expect(store.saveCouples(final.id, [{ leaderId: people.get("101")!, followerId: people.get("102")! }])).rejects.toMatchObject({ code: "invalid" });
      await expect(
        store.saveCouples(final.id, [
          { leaderId: people.get("1")!, followerId: people.get("101")! },
          { leaderId: people.get("2")!, followerId: people.get("101")! }
        ])
      ).rejects.toMatchObject({ code: "invalid" });
      await expect(store.saveCouples(prelim.id, [])).rejects.toMatchObject({ code: "invalid" });
      expect(await store.listFinalScores(final.id)).toEqual([]);

      await store.savePlacements(final.id, [
        { coupleId: couples[1].id, place: 1 },
        { coupleId: couples[0].id, place: 2 }
      ]);
      expect(await store.listPlacements(final.id)).toEqual([
        { coupleId: couples[1].id, place: 1 },
        { coupleId: couples[0].id, place: 2 }
      ]);
      await expect(store.savePlacements(final.id, [{ coupleId: couples[0].id, place: 1 }, { coupleId: couples[1].id, place: 1 }])).rejects.toMatchObject({ code: "invalid" });
    });
  });
}
