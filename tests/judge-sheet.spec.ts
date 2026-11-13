import { expect, test, type Page } from "@playwright/test";
import { buildHeats } from "../src/core/heats";
import { createOrganiser, liveDisabled, signIn } from "./live";

/*
 * Ticket 4: a link opens only its own round and role; a wrong token shows nothing.
 * Ticket 5: double-tap scoring with heat and overall views, autosave, offline queue and submit.
 */
test.skip(liveDisabled, "live Supabase test");

async function setUpRound() {
  const organiser = await createOrganiser();
  const store = await organiser.store();
  const contest = await store.createContest("Novice Jack & Jill");
  const round = await store.addRound(contest.id, "prelim");
  await store.updateRoundSettings(round.id, { yesCount: 1, altCount: 1, maxPerHeat: 2 });
  await store.addCompetitors(contest.id, [
    { bib: "1", role: "leader" },
    { bib: "2", role: "leader" },
    { bib: "3", role: "leader" },
    { bib: "101", role: "follower", name: "Bo" }
  ]);
  await store.saveHeats(round.id, buildHeats({ leaders: ["1", "2", "3"], followers: ["101"], maxPerHeat: 2 }));
  const lee = await store.addJudge(round.id, { name: "Lee", assignment: "leaders" });
  const cat = await store.addJudge(round.id, { name: "Cat", assignment: "both", isChief: true });
  return { organiser, store, contest, round, lee, cat };
}

async function doubleTapAt(page: Page, bib: string, fraction: number) {
  const track = page.getByTestId(`track-${bib}`);
  const box = (await track.boundingBox())!;
  await track.dblclick({ position: { x: box.width * fraction, y: box.height / 2 } });
}

test("organiser makes a judge link, and a wrong link shows nothing", async ({ page, browser }) => {
  const { organiser, contest, round } = await setUpRound();
  try {
    await signIn(page, organiser.email, `/contests/${contest.id}/rounds/${round.id}`);
    const links = page.getByRole("region", { name: "Private links" });
    await links.getByRole("button", { name: "Make link for Lee" }).click();
    const url = await links.getByRole("textbox", { name: "Link for Lee" }).inputValue();
    expect(url).toMatch(/\/l\/[A-Za-z0-9_-]{43}$/);

    const judge = await (await browser.newContext()).newPage();
    await judge.goto(url);
    await expect(judge.getByRole("heading", { name: "Judge: Lee" })).toBeVisible();
    await expect(judge.getByLabel("Bib 101")).toHaveCount(0);

    await judge.goto(`${url.slice(0, -2)}xx`);
    await expect(judge.getByRole("heading", { name: "This link doesn't work" })).toBeVisible();

    // Making a new link stops the old one.
    await links.getByRole("button", { name: "Make new link for Lee" }).click();
    await expect(links.getByRole("textbox", { name: "Link for Lee" })).not.toHaveValue(url);
    await judge.goto(url);
    await expect(judge.getByRole("heading", { name: "This link doesn't work" })).toBeVisible();
  } finally {
    await organiser.remove();
  }
});

test("judge scores by double tap, keeps scoring offline, and submits", async ({ browser }) => {
  const { organiser, store, round, lee } = await setUpRound();
  try {
    const { token } = await store.createAccessLink(round.id, { kind: "judge", judgeId: lee.id });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/l/${token}`);
    await expect(page.getByRole("status")).toHaveText("Saved");

    // Heat 1 has bibs 1 and 2. Double tap sets a score near the tap; double tap again clears it.
    await doubleTapAt(page, "1", 0.9);
    await expect(page.getByTestId("score-1")).toHaveText(/^(8[5-9]|9[0-5])\.\d$/);
    await doubleTapAt(page, "1", 0.5);
    await expect(page.getByTestId("score-1")).toHaveText("–");
    await doubleTapAt(page, "1", 0.9);
    await page.getByRole("button", { name: "Raise 1 by 0.1" }).click();
    await doubleTapAt(page, "2", 0.6);
    await expect(page.getByRole("status")).toHaveText("Saved");

    // Heat 2: bib 3 plus bib 1 as a redancer, who cannot be scored here.
    await page.getByRole("button", { name: "Heat 2" }).click();
    await expect(page.getByLabel("Bib 1, redancer")).toContainText("scored in heat 1");
    await expect(page.getByTestId("track-1")).toHaveCount(0);

    // Lose the connection, keep scoring, reload offline-saved state, then reconnect.
    await context.setOffline(true);
    await doubleTapAt(page, "3", 0.3);
    await expect(page.getByRole("status")).toHaveText(/Offline, 1 waiting/);
    await context.setOffline(false);
    await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 20_000 });

    const before = (await page.getByTestId("score-3").textContent())!;
    await page.reload();
    await page.getByRole("button", { name: "Heat 2" }).click();
    await expect(page.getByTestId("score-3")).toHaveText(before);

    // Overall view ranks everyone once.
    await page.getByRole("button", { name: "Overall" }).click();
    await expect(page.getByRole("list", { name: "Leaders sheet" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("list", { name: "Leaders sheet" }).getByRole("listitem").first()).toHaveAttribute("aria-label", "Bib 1");

    await page.getByRole("button", { name: "Submit leaders" }).click();
    await page.getByRole("button", { name: "Tap again to submit leaders" }).click();
    await expect(page.getByText("Leaders submitted.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Leaders submitted.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Raise 1 by 0.1" })).toHaveCount(0);
  } finally {
    await organiser.remove();
  }
});

test("offline scores made before a reload still reach the database after reconnecting", async ({ browser }) => {
  const { organiser, store, round, cat } = await setUpRound();
  try {
    const { token } = await store.createAccessLink(round.id, { kind: "judge", judgeId: cat.id });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/l/${token}`);
    await expect(page.getByRole("tab", { name: "Leaders" })).toBeVisible();
    await context.setOffline(true);
    await doubleTapAt(page, "1", 0.8);
    await doubleTapAt(page, "2", 0.4);
    await expect(page.getByRole("status")).toHaveText(/Offline, 2 waiting/);

    // A fresh page in the same browser picks the waiting scores back up.
    await context.setOffline(false);
    const again = await context.newPage();
    await page.close();
    await again.goto(`/l/${token}`);
    await expect(again.getByRole("status")).toHaveText("Saved", { timeout: 20_000 });
    await again.reload();
    await expect(again.getByTestId("score-1")).not.toHaveText("–");
    await expect(again.getByTestId("score-2")).not.toHaveText("–");
  } finally {
    await organiser.remove();
  }
});
