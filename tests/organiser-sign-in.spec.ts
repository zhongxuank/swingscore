import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/*
 * Ticket 2 "done when": the organiser signs in and creates a contest with a prelim round that survives a reload.
 * Runs against the real Supabase project with SUPABASE_LIVE_TESTS=1. It signs in a throwaway organiser through
 * the app's callback with an admin-generated link, so no email is sent, and deletes that organiser afterwards.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(process.env.SUPABASE_LIVE_TESTS !== "1" || !url || !serviceKey, "live Supabase test");

const admin = () => createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

test("organiser signs in, creates a contest with a prelim, and it survives a reload", async ({ page }) => {
  const email = `swingscore-test-${randomUUID()}@example.com`;
  const created = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;

  try {
    await page.goto("/contests");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fcontests/);

    const link = await admin().auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    await page.goto(`/auth/callback?token_hash=${link.data.properties.hashed_token}&type=magiclink&next=/contests`);
    await expect(page).toHaveURL(/\/contests$/);
    await expect(page.getByRole("heading", { name: "Contests" })).toBeVisible();

    await page.getByLabel("New contest name").fill("Novice Jack & Jill");
    await page.getByRole("button", { name: "Create contest" }).click();
    await expect(page).toHaveURL(/\/contests\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "Add Prelim" }).click();
    const prelim = page.getByRole("form", { name: "Prelim settings" });
    await prelim.getByLabel("Yes per judge").fill("9");
    await prelim.getByLabel("Alternates per judge").fill("3");
    await prelim.getByLabel("Max per heat").fill("20");
    await prelim.getByRole("button", { name: "Save round" }).click();
    await expect(prelim.getByRole("button", { name: "Save round" })).toBeEnabled();

    await page.reload();
    const reloaded = page.getByRole("form", { name: "Prelim settings" });
    await expect(page.getByLabel("Contest name")).toHaveValue("Novice Jack & Jill");
    await expect(reloaded.getByLabel("Yes per judge")).toHaveValue("9");
    await expect(reloaded.getByLabel("Alternates per judge")).toHaveValue("3");
    await expect(reloaded.getByLabel("Max per heat")).toHaveValue("20");
    await expect(page.getByRole("button", { name: "Add Prelim" })).toHaveCount(0);

    await page.goto("/contests");
    await expect(page.getByRole("link", { name: "Novice Jack & Jill" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/contests");
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await admin().auth.admin.deleteUser(created.data.user.id);
  }
});

test("a bad sign-in link shows an error, not the contests", async ({ page }) => {
  await page.goto("/auth/callback?token_hash=not-a-real-token&type=magiclink&next=/contests");
  await expect(page).toHaveURL(/\/sign-in\?error=link/);
  await expect(page.getByText("That sign-in link did not work")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contests" })).toHaveCount(0);
});
