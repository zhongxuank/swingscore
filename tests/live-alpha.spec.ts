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
  await page.getByRole("button", { name: /results/i }).click();
  await expect(page.getByText("Derived callbacks")).toBeVisible();
});
