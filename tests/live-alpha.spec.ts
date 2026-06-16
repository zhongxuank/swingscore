import { expect, test, type Locator } from "@playwright/test";

async function clickScore(slider: Locator, score: number) {
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  await slider.click({
    position: {
      x: (box?.width ?? 0) * (score / 100),
      y: (box?.height ?? 0) / 2
    }
  });
  await expect(slider).toHaveAttribute("aria-valuenow", String(score));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/competitions");
  await page.evaluate(() => window.localStorage.clear());
});

test("admin demo exposes live-alpha workflow", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: /open contest manager/i }).click();
  await expect(page.getByRole("heading", { name: "Contests", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /open demo contest/i }).click();
  await expect(page.getByRole("heading", { name: /novice jack and jill/i })).toBeVisible();
  await page.getByRole("button", { name: "Results" }).click();
  await expect(page.getByText("Leader advancement")).toBeVisible();
  await expect(page.getByText("Follower advancement")).toBeVisible();
});

test("contest manager can create edit archive and restore contests", async ({ page }) => {
  await page.goto("/admin/competitions");
  await page.getByTestId("contest-name-input").pressSequentially("Sophisticated Jack and Jill");
  await page.getByTestId("contest-division-input").pressSequentially("Sophisticated");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Sophisticated Jack and Jill")).toBeVisible();
  await page.getByTestId("contest-edit-sophisticated-jack-and-jill").click();
  await page.getByTestId("contest-name-input").fill("Sophisticated Strictly Swing");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Sophisticated Strictly Swing")).toBeVisible();
  await page.getByTestId("contest-archive-sophisticated-jack-and-jill").click();
  await expect(page.getByText("Archived contests")).toBeVisible();
  await page.getByTestId("contest-restore-sophisticated-jack-and-jill").click();
  await expect(page.getByText("Sophisticated Strictly Swing")).toBeVisible();
});

test("new contest opens as its own empty workspace and can add a prelim round", async ({ page }) => {
  await page.goto("/admin/competitions");
  await page.getByTestId("contest-name-input").pressSequentially("QA Strictly Swing");
  await page.getByTestId("contest-division-input").pressSequentially("QA");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByTestId("contest-open-qa-strictly-swing").click();
  await expect(page.getByRole("heading", { name: "QA Strictly Swing" })).toBeVisible();
  await expect(page.getByText("No rounds yet")).toBeVisible();
  await expect(page.getByText("Novice Jack and Jill")).toHaveCount(0);
  await page.getByRole("button", { name: "Add Prelim Callback Round" }).click();
  await expect(page.getByRole("heading", { name: "Prelims" })).toBeVisible();
  await expect(page.getByText("Callback Round setup")).toBeVisible();
  await page.getByRole("button", { name: "Judges" }).click();
  await expect(page.getByLabel("Chief Judge score counts")).not.toBeChecked();
  await page.getByLabel("Chief Judge score counts").check();
  await expect(page.getByText("Included as a normal callback scoring sheet.")).toBeVisible();
  await expect(page.getByTestId("counted-leaders")).toContainText("4 counted");
  await expect(page.getByTestId("counted-followers")).toContainText("4 counted");
  await page.getByTestId("chief-role-leaders").click();
  await expect(page.getByTestId("counted-leaders")).toContainText("4 counted");
  await expect(page.getByTestId("counted-leaders")).toContainText("Chief Judge");
  await expect(page.getByTestId("counted-followers")).toContainText("3 counted");
  await expect(page.getByTestId("counted-followers")).not.toContainText("Chief Judge");
  await page.getByRole("link", { name: "Contest Manager" }).click();
  await expect(page.getByTestId("contest-card-qa-strictly-swing")).toContainText("1 rounds");
});

test("created contest exposes round access links with local context", async ({ page }) => {
  await page.goto("/admin/competitions");
  await page.getByTestId("contest-name-input").pressSequentially("Access Link QA");
  await page.getByTestId("contest-division-input").pressSequentially("QA");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByTestId("contest-open-access-link-qa").click();
  await page.getByRole("button", { name: "Add Prelim Callback Round" }).click();
  await page.getByRole("button", { name: "Access" }).click();
  await expect(page.getByRole("heading", { name: "Access links" })).toBeVisible();
  await expect(page.getByText("Links locked")).toBeVisible();

  await page.getByRole("button", { name: "Judges" }).click();
  await page.getByLabel("Number of scoring judges").fill("5");
  await page.getByTestId("judge-name-1").fill("Alice Lead");
  await page.getByTestId("judge-name-2").fill("Ben Follow");
  await page.getByTestId("judge-name-3").fill("Casey Both");
  await page.getByTestId("judge-name-4").fill("Drew Both");
  await page.getByTestId("judge-name-5").fill("Eli Both");
  await page.getByTestId("chief-judge-name").fill("Morgan Chief");
  await page.getByTestId("judge-role-1-leaders").click();
  await page.getByTestId("judge-role-2-followers").click();
  await page.getByTestId("confirm-judge-panel").click();
  await expect(page.getByTestId("admin-notice")).toContainText("judging panel confirmed");

  await page.getByRole("button", { name: "Access" }).click();
  await expect(page.getByTestId("access-link-judge-access-link-qa-round-prelim-judge-1")).toContainText("Alice Lead - Leaders");
  await expect(page.getByTestId("access-link-judge-access-link-qa-round-prelim-judge-2")).toContainText("Ben Follow - Followers");
  await expect(page.getByTestId("access-link-chief-chief")).toContainText("Chief Judge");
  await expect(page.getByTestId("access-link-emcee-emcee")).toContainText("Emcee");
  await expect(page.getByTestId("whatsapp-message-preview")).toContainText("*QA Prelims Judge Sheets*");
  await expect(page.getByTestId("whatsapp-message-preview")).toContainText("Morgan Chief (Chief Judge):");
  await expect(page.getByTestId("whatsapp-message-preview")).toContainText("Alice Lead (Leader):");
  await expect(page.getByTestId("whatsapp-message-preview")).toContainText("Ben Follow (Follower):");
  await expect(page.getByTestId("whatsapp-message-preview")).not.toContainText("Emcee:");

  await Promise.all([
    page.waitForURL("**/judge/**"),
    page.getByTestId("access-open-judge-access-link-qa-round-prelim-judge-1").click()
  ]);
  await expect(page.getByRole("heading", { name: "Access Link QA" })).toBeVisible();
  await expect(page.getByText("Prelims Callback Round. Assigned sheet: Leaders.")).toBeVisible();
});

test("admin can generate semi-final and final rounds from callback results", async ({ page }) => {
  await page.goto("/admin/competitions/demo-novice-jj");
  await page.getByRole("button", { name: "Semi-Final Callback Round" }).click();
  await expect(page.getByRole("heading", { name: "Semi-Finals" })).toBeVisible();
  await expect(page.getByTestId("admin-notice")).toContainText("Semi-Final Callback Round generated");
  await page.getByRole("button", { name: "Final Round", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Finals" })).toBeVisible();
  await expect(page.getByText("Final rounds need an odd number of scoring judges.")).toBeVisible();
  await page.getByRole("button", { name: "Judges" }).click();
  await page.getByLabel("Chief Judge score counts").check();
  await expect(page.getByText("Included in the odd-number finals panel.")).toBeVisible();
  await expect(page.getByTestId("counted-panel-summary")).toContainText("5 finals scoring judges");
  await page.getByRole("button", { name: "Setup" }).click();
  await expect(page.getByText("Panel is valid")).toBeVisible();
});

test("admin heat sheet splits leaders and followers into columns", async ({ page }) => {
  await page.goto("/admin/competitions/demo-novice-jj");
  await page.getByRole("button", { name: "Heats" }).click();
  await expect(page.getByTestId("heat-1-leader")).toContainText("101");
  await expect(page.getByTestId("heat-1-leader")).not.toContainText("201");
  await expect(page.getByTestId("heat-1-follower")).toContainText("201");
  await expect(page.getByTestId("heat-1-follower")).not.toContainText("101");
});

test("emcee heat sheet splits leaders and followers into columns", async ({ page }) => {
  await page.goto("/emcee/demo-emcee");
  await page.getByRole("button", { name: "Heats" }).click();
  await expect(page.getByTestId("heat-1-leader")).toContainText("101");
  await expect(page.getByTestId("heat-1-leader")).not.toContainText("201");
  await expect(page.getByTestId("heat-1-follower")).toContainText("201");
  await expect(page.getByTestId("heat-1-follower")).not.toContainText("101");
});

test("judge can score and submit demo sheet", async ({ page }) => {
  await page.goto("/judge/demo-judge");
  await expect(page.getByRole("heading", { name: /novice jack and jill/i })).toBeVisible();
  await expect(page.getByText("Assigned sheet: Leaders.")).toBeVisible();
  await expect(page.locator('[role="slider"]')).toHaveCount(8);
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Score Jamie" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Score Alex" })).toContainText("101");
  await expect(page.getByRole("slider", { name: "Score Alex" })).toContainText("Alex");
  await expect(page.getByRole("slider", { name: "Score Alex" })).not.toContainText("Swipe sideways");
  await expect(page.getByRole("slider", { name: "Score Alex" })).toHaveAttribute("data-score-status", "yes");
  await page.getByRole("button", { name: /results/i }).click();
  await expect(page.getByText("Derived callbacks")).toBeVisible();
});

test("both-role judge toggles between separate role sheets", async ({ page }) => {
  await page.goto("/judge/demo-both");
  await expect(page.getByTestId("judge-role-toggle")).toBeVisible();
  await expect(page.locator('[role="slider"]')).toHaveCount(8);
  await expect(page.getByRole("slider", { name: "Score Alex" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Score Jamie" })).toHaveCount(0);
  await page.getByRole("button", { name: "Followers" }).click();
  await expect(page.locator('[role="slider"]')).toHaveCount(8);
  await expect(page.getByRole("slider", { name: "Score Jamie" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Score Alex" })).toHaveCount(0);
});

test("judge warnings stay in the bottom action area", async ({ page }) => {
  await page.goto("/judge/demo-judge");
  const alexScore = page.getByRole("slider", { name: "Score Alex" });
  await expect(alexScore).toHaveAttribute("data-score-status", "yes");
  await alexScore.click({ position: { x: 1, y: 24 } });
  await expect(alexScore).toHaveAttribute("data-score-status", "unscored");
  await expect(page.getByTestId("judge-warning")).toContainText("L101 is unscored");
  await expect(page.getByTestId("judge-action-panel")).toContainText("Submit leaders scores");
  await expect(page.getByRole("button", { name: /submit leaders scores/i })).toBeDisabled();
});

test("judge boundary ties highlight matching bib groups", async ({ page }) => {
  await page.goto("/judge/demo-judge");
  const rileyScore = page.getByRole("slider", { name: "Score Riley" });
  const caseyScore = page.getByRole("slider", { name: "Score Casey" });
  const taylorScore = page.getByRole("slider", { name: "Score Taylor" });
  const quinnScore = page.getByRole("slider", { name: "Score Quinn" });

  await clickScore(caseyScore, 83.5);
  await clickScore(quinnScore, 79);

  await expect(page.getByTestId("judge-warning")).toContainText("Tie 1: Leader yes boundary tie at 4 at 83.5; tied bibs 104, 105.");
  await expect(page.getByTestId("judge-warning")).toContainText("Tie 2: Leader alternate boundary tie at 7 at 79.0; tied bibs 107, 108.");
  await expect(rileyScore).toHaveAttribute("data-score-tie-group", "Tie 1");
  await expect(caseyScore).toHaveAttribute("data-score-tie-group", "Tie 1");
  await expect(taylorScore).toHaveAttribute("data-score-tie-group", "Tie 2");
  await expect(quinnScore).toHaveAttribute("data-score-tie-group", "Tie 2");
  await expect(rileyScore).not.toContainText("Tie 1");
  await expect(quinnScore).not.toContainText("Tie 2");
});

test("chief judge uses the same raw-score slider interface", async ({ page }) => {
  await page.goto("/chief/demo-chief");
  await expect(page.getByRole("heading", { name: /raw score review/i })).toBeVisible();
  await expect(page.locator('[role="slider"]')).toHaveCount(16);
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Chief Judge score Alex" })).toContainText("101");
  await expect(page.getByRole("slider", { name: "Chief Judge score Alex" })).toContainText("Alex");
  await expect(page.getByRole("slider", { name: "Chief Judge score Alex" })).not.toContainText("Swipe sideways");
});
