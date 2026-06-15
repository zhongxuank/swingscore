import { expect, test } from "@playwright/test";

test("admin demo exposes live-alpha workflow", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: /open demo event/i }).click();
  await expect(page.getByRole("heading", { name: /swingscore live alpha/i })).toBeVisible();
  await page.getByRole("button", { name: "Results" }).click();
  await expect(page.getByText("Leader advancement")).toBeVisible();
  await expect(page.getByText("Follower advancement")).toBeVisible();
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
  await alexScore.focus();
  await alexScore.press("Home");
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

  for (let step = 0; step < 3; step += 1) {
    await caseyScore.press("ArrowRight");
    await quinnScore.press("ArrowRight");
  }

  await expect(page.getByTestId("judge-warning")).toContainText("Tie 1: Leader yes boundary tie at 4 at 83.5; tied bibs 104, 105.");
  await expect(page.getByTestId("judge-warning")).toContainText("Tie 2: Leader alternate boundary tie at 7 at 79.0; tied bibs 107, 108.");
  await expect(rileyScore).toHaveAttribute("data-score-tie-group", "Tie 1");
  await expect(caseyScore).toHaveAttribute("data-score-tie-group", "Tie 1");
  await expect(taylorScore).toHaveAttribute("data-score-tie-group", "Tie 2");
  await expect(quinnScore).toHaveAttribute("data-score-tie-group", "Tie 2");
  await expect(rileyScore).toContainText("Tie 1");
  await expect(quinnScore).toContainText("Tie 2");
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
