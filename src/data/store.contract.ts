import { describe, expect, it } from "vitest";
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
  });
}
