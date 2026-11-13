import { expect, test } from "@playwright/test";
import { createOrganiser, liveDisabled, signIn } from "./live";

// Ticket 2 "done when": the organiser signs in and creates a contest with a prelim round that survives a reload.
test.skip(liveDisabled, "live Supabase test");

test("organiser signs in, creates a contest with a prelim, and it survives a reload", async ({ page }) => {
  const organiser = await createOrganiser();

  try {
    await page.goto("/contests");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fcontests/);

    await signIn(page, organiser.email);
    await expect(page.getByRole("heading", { name: "Contests" })).toBeVisible();

    await page.getByLabel("New contest name").fill("Novice Jack & Jill");
    await page.getByRole("button", { name: "Create contest" }).click();
    await expect(page).toHaveURL(/\/contests\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "Add Prelim" }).click();
    await expect(page.getByRole("button", { name: "Add Prelim" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("Contest name")).toHaveValue("Novice Jack & Jill");

    await page.getByRole("link", { name: /1\. Prelim/ }).click();
    await expect(page.getByRole("heading", { name: "Prelim", exact: true })).toBeVisible();
    const prelim = page.getByRole("form", { name: "Prelim settings" });
    await prelim.getByLabel("Yes per judge").fill("9");
    await prelim.getByLabel("Alternates per judge").fill("3");
    await prelim.getByLabel("Max per heat").fill("20");
    await prelim.getByRole("button", { name: "Save round" }).click();
    await expect(page.getByRole("form", { name: "Prelim settings" }).getByRole("button", { name: "Save round" })).toBeEnabled();

    await page.reload();
    const reloaded = page.getByRole("form", { name: "Prelim settings" });
    await expect(reloaded.getByLabel("Yes per judge")).toHaveValue("9");
    await expect(reloaded.getByLabel("Alternates per judge")).toHaveValue("3");
    await expect(reloaded.getByLabel("Max per heat")).toHaveValue("20");

    await page.goto("/contests");
    await expect(page.getByRole("link", { name: "Novice Jack & Jill" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/contests");
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await organiser.remove();
  }
});

test("a bad sign-in link shows an error, not the contests", async ({ page }) => {
  await page.goto("/auth/callback?token_hash=not-a-real-token&type=magiclink&next=/contests");
  await expect(page).toHaveURL(/\/sign-in\?error=link/);
  await expect(page.getByText("That sign-in link did not work")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contests" })).toHaveCount(0);
});
