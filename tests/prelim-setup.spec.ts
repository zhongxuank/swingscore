import { expect, test } from "@playwright/test";
import { createOrganiser, liveDisabled, signIn } from "./live";

// Ticket 3 "done when": 70 leaders and 80 followers at 20 per heat give 4 heats with marked redancers.
test.skip(liveDisabled, "live Supabase test");

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => String(from + i));

test("organiser enters competitors, a panel and builds prelim heats with redancers", async ({ page }) => {
  test.setTimeout(90_000);
  const organiser = await createOrganiser();
  try {
    await signIn(page, organiser.email);
    await page.getByLabel("New contest name").fill("Newcomer Jack & Jill");
    await page.getByRole("button", { name: "Create contest" }).click();
    await expect(page).toHaveURL(/\/contests\/[0-9a-f-]{36}$/);

    // 70 leaders written with L, 80 followers as bare bibs with the default role set to followers.
    await page.getByLabel(/Add competitors, one per line/).fill(range(1, 70).map((bib) => `${bib} L`).join("\n"));
    await page.getByRole("button", { name: "Add competitors" }).click();
    await expect(page.getByText("70 leaders, 0 followers")).toBeVisible();
    await page.getByLabel(/Add competitors, one per line/).fill(range(101, 80).join("\n"));
    await page.getByLabel("Lines without L or F are").selectOption("follower");
    await page.getByRole("button", { name: "Add competitors" }).click();
    await expect(page.getByText("70 leaders, 80 followers")).toBeVisible();

    // A duplicate bib is refused and nothing is added.
    await page.getByLabel(/Add competitors, one per line/).fill("200 L\n5 L");
    await page.getByRole("button", { name: "Add competitors" }).click();
    await expect(page.getByText("Bib 5 is already in this contest.")).toBeVisible();
    await expect(page.getByText("70 leaders, 80 followers")).toBeVisible();

    await page.getByRole("button", { name: "Add Prelim" }).click();
    await page.getByRole("link", { name: /1\. Prelim/ }).click();
    const settings = page.getByRole("form", { name: "Prelim settings" });
    await settings.getByLabel("Yes per judge").fill("9");
    await settings.getByLabel("Alternates per judge").fill("3");
    await settings.getByLabel("Max per heat").fill("20");
    await settings.getByRole("button", { name: "Save round" }).click();
    await expect(page.getByRole("button", { name: "Build heats" })).toBeEnabled();

    // Panel: problems shown until there is a chief judge and a judge per role.
    const panel = page.getByRole("region", { name: "Panel" });
    await expect(panel.getByLabel("Panel problems")).toContainText("Add a chief judge.");
    await panel.getByLabel("Chief judge name").fill("Cat");
    await panel.getByRole("button", { name: "Set chief judge" }).click();
    await expect(panel.getByText("judges both roles")).toBeVisible();
    await panel.getByLabel("Judge name", { exact: true }).fill("Lee");
    await panel.getByRole("button", { name: "Add judge" }).click();
    await expect(panel.getByLabel("Panel problems")).toContainText("Add at least one judge for followers.");
    await panel.getByLabel("Judge name", { exact: true }).fill("Fay");
    await panel.getByLabel("New judge's role").selectOption("followers");
    await panel.getByRole("button", { name: "Add judge" }).click();
    await expect(panel.getByText("Panel is complete.")).toBeVisible();

    await page.getByRole("button", { name: "Build heats" }).click();
    const heats = page.getByRole("region", { name: "Heats" });
    await expect(heats.getByText("4 heats.")).toBeVisible();

    const checkHeats = async () => {
      const heat4Leaders = heats.getByRole("list", { name: "Heat 4 leaders" }).getByRole("listitem");
      await expect(heat4Leaders).toHaveCount(20);
      await expect(heat4Leaders.filter({ hasText: "(redancer)" })).toHaveCount(10);
      await expect(heats.getByRole("list", { name: "Heat 4 followers" }).getByRole("listitem")).toHaveCount(20);
      await expect(heats.getByRole("list", { name: "Heat 4 followers" }).getByRole("listitem").filter({ hasText: "(redancer)" })).toHaveCount(0);
      await expect(heats.getByRole("list", { name: "Heat 1 leaders" }).getByRole("listitem").first()).toHaveText("1");
    };
    await checkHeats();

    await page.reload();
    await checkHeats();
    await expect(page.getByRole("region", { name: "Panel" }).getByText("Panel is complete.")).toBeVisible();

    // Removing a competitor marks the heats out of date.
    await page.goto(page.url().replace(/\/rounds\/.*$/, ""));
    await page.getByRole("button", { name: "Remove leader 70" }).click();
    await expect(page.getByText("69 leaders, 80 followers")).toBeVisible();
    await page.getByRole("link", { name: /1\. Prelim/ }).click();
    await expect(page.getByText("Competitors or the heat size have changed since these heats were built.")).toBeVisible();
    await page.getByRole("button", { name: "Rebuild heats" }).click();
    await expect(page.getByText("Competitors or the heat size have changed")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Heat 4 leaders" }).getByRole("listitem").filter({ hasText: "(redancer)" })).toHaveCount(11);
  } finally {
    await organiser.remove();
  }
});
