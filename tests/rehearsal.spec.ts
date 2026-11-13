import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { buildHeats } from "../src/core/heats";
import { createSupabaseAccess } from "../src/data/supabase-access";
import { createOrganiser, liveDisabled, signIn } from "./live";

/*
 * Ticket 11, automated part: a prelim and a final run from sign-up to results with no manual database fixes.
 * Most judges score through the same calls their sheets make; the chief judge, organiser and emcee use the screens.
 */
test.skip(liveDisabled, "live Supabase test");
test.setTimeout(180_000);

const access = () =>
  createSupabaseAccess(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }));

test("prelim to final, with the chief judge's cut, a draw and published placements", async ({ page, browser }) => {
  const organiser = await createOrganiser();
  try {
    const store = await organiser.store();
    const contest = await store.createContest("Rehearsal Jack & Jill");
    const prelim = await store.addRound(contest.id, "prelim");
    const final = await store.addRound(contest.id, "final");
    const leaders = ["1", "2", "3", "4", "5", "6"];
    const followers = ["101", "102", "103", "104", "105", "106"];
    await store.addCompetitors(contest.id, [
      ...leaders.map((bib) => ({ bib, role: "leader" as const, name: `Lead ${bib}` })),
      ...followers.map((bib) => ({ bib, role: "follower" as const, name: `Follow ${bib}` }))
    ]);
    await store.updateRoundSettings(prelim.id, { maxPerHeat: 3 });
    await store.saveHeats(prelim.id, buildHeats({ leaders, followers, maxPerHeat: 3 }));
    const people = new Map((await store.listCompetitors(contest.id)).map((c) => [c.bib, c.id]));

    const lj = await store.addJudge(prelim.id, { name: "LJ", assignment: "leaders" });
    const fj = await store.addJudge(prelim.id, { name: "FJ", assignment: "followers" });
    const cj = await store.addJudge(prelim.id, { name: "CJ", assignment: "both", isChief: true });
    const link = async (judgeId: string) => (await store.createAccessLink(prelim.id, { kind: "judge", judgeId })).token;
    const [ljToken, fjToken, cjToken] = [await link(lj.id), await link(fj.id), await link(cj.id)];
    const emceeToken = (await store.createAccessLink(prelim.id, { kind: "emcee" })).token;

    // The chief judge sets 3 Yes and 1 Alternate on their screen.
    const chief = await (await browser.newContext()).newPage();
    await chief.goto(`/l/${cjToken}`);
    await chief.getByRole("tab", { name: "Counts and cut" }).click();
    await chief.getByLabel("Yes").fill("3");
    await chief.getByLabel("Alternates", { exact: true }).fill("1");
    await chief.getByRole("button", { name: "Save counts" }).click();
    await expect(chief.getByText("Counts saved.")).toBeVisible();

    // Judges score: lower bibs score higher, so 1, 2, 3 and 101, 102, 103 go through.
    const a = access();
    const at = (n: number) => new Date(Date.UTC(2026, 10, 13, 12, 0, n)).toISOString();
    for (const [index, bib] of leaders.entries()) {
      await a.saveScore(ljToken, people.get(bib)!, 900 - index * 50, at(index));
      await a.saveScore(cjToken, people.get(bib)!, 880 - index * 40, at(index));
    }
    for (const [index, bib] of followers.entries()) {
      await a.saveScore(fjToken, people.get(bib)!, 900 - index * 50, at(index));
      await a.saveScore(cjToken, people.get(bib)!, 870 - index * 40, at(index));
    }
    for (const [token, roles] of [[ljToken, ["leader"]], [fjToken, ["follower"]], [cjToken, ["leader", "follower"]]] as const) {
      for (const role of roles) await a.submitSheet(token, role);
    }

    // The chief judge sends 3 of each through with 1 alternate.
    await chief.reload();
    await chief.getByRole("tab", { name: "Counts and cut" }).click();
    for (const role of ["Leaders", "Followers"]) {
      const column = chief.getByRole("region", { name: `${role} results` });
      await column.getByLabel(`${role} advancing`).fill("3");
      await column.getByLabel(`${role} alternates`).fill("1");
      await column.getByRole("button", { name: `Decide ${role.toLowerCase()} cut` }).click();
      await column.getByRole("button", { name: `Tap again to confirm 3 ${role.toLowerCase()}` }).click();
      await expect(column.getByText("Decided: 3 advance, 1 alternates.")).toBeVisible();
    }

    // The emcee reads the callbacks and the alternate.
    const emcee = await (await browser.newContext()).newPage();
    await emcee.goto(`/l/${emceeToken}`);
    const leaderCallbacks = emcee.getByLabel("Leaders callbacks");
    await expect(leaderCallbacks).toContainText("1 Lead 1");
    await expect(leaderCallbacks).toContainText("3 Lead 3");
    await expect(leaderCallbacks).toContainText("Alt 1: 4 Lead 4");
    await expect(leaderCallbacks).not.toContainText("5 Lead 5");

    // The organiser builds the final's couples from the draw on screen.
    await signIn(page, organiser.email, `/contests/${contest.id}/rounds/${final.id}`);
    const couples = page.getByRole("region", { name: "Couples" });
    await expect(couples.getByText("3 leaders and 3 followers in this final.")).toBeVisible();
    await couples.getByLabel("Shift").fill("1");
    await couples.getByRole("button", { name: "Generate couples" }).click();
    await expect(couples.getByLabel("Partner for leader 1")).toHaveValue("102");
    await couples.getByRole("button", { name: "Save couples" }).click();
    await expect(couples.getByLabel("Saved couples").getByRole("listitem")).toHaveCount(3);

    // Three final judges score couples 1 > 2 > 3, except one who swaps 2 and 3.
    const finalJudges = await Promise.all(["F1", "F2", "F3"].map((name) => store.addJudge(final.id, { name, assignment: "both" })));
    const finalCouples = await store.listCouples(final.id);
    for (const [index, judge] of finalJudges.entries()) {
      const token = (await store.createAccessLink(final.id, { kind: "judge", judgeId: judge.id })).token;
      const order = index === 2 ? [900, 700, 800] : [900, 800, 700];
      for (const [i, couple] of finalCouples.entries()) await a.saveFinalScore(token, couple.id, order[i], at(i));
      await a.submitFinalSheet(token);
    }
    await expect(couples.getByText("Scoring has started, so the couples are fixed.")).toBeVisible({ timeout: 20_000 }).catch(async () => {
      await page.reload();
      await expect(page.getByRole("region", { name: "Couples" }).getByText("Scoring has started, so the couples are fixed.")).toBeVisible();
    });

    await page.reload();
    const results = page.getByRole("region", { name: "Final results" });
    await expect(results.getByLabel("Relative Placement").getByRole("listitem").first()).toContainText("#1 (1 / 102)");
    await results.getByRole("button", { name: "Publish placements" }).click();
    await expect(results.getByText("Published.")).toBeVisible();

    const finalEmcee = await (await browser.newContext()).newPage();
    await finalEmcee.goto(`/l/${(await store.createAccessLink(final.id, { kind: "emcee" })).token}`);
    const placements = finalEmcee.getByRole("region", { name: "Placements" });
    await expect(placements.getByRole("listitem").first()).toContainText("1. 1 Lead 1 & 102 Follow 102");
    await expect(placements.getByRole("listitem")).toHaveCount(3);
  } finally {
    await organiser.remove();
  }
});
