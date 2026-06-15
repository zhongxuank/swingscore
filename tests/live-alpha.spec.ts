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
  await expect(page.getByRole("slider", { name: "Score Alex" })).toContainText("Swipe sideways to score");
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

test("chief judge uses the same raw-score slider interface", async ({ page }) => {
  await page.goto("/chief/demo-chief");
  await expect(page.getByRole("heading", { name: /raw score review/i })).toBeVisible();
  await expect(page.locator('[role="slider"]')).toHaveCount(16);
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Chief Judge score Alex" })).toContainText("Swipe sideways to set CJ raw score");
});
