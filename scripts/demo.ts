/*
 * Local testing helpers. They need .env.local with the Supabase URL, the publishable key and the secret
 * (service role) key, which stays on your machine and is never committed.
 *
 *   npm run signin -- you@example.com   prints a sign-in link for that organiser, no email sent
 *   npm run demo -- you@example.com     also makes a demo contest with competitors, a judging panel,
 *                                       heats and every private link, and prints them all
 *
 * The organiser account is created if it doesn't exist yet. Links are also saved to demo-links.txt
 * (ignored by git). Run the app with `npm run dev` first, so the links open.
 */
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildHeats } from "../src/core/heats";
import { accessLinkPath } from "../src/lib/access-token";
import { createSupabaseAccess } from "../src/data/supabase-access";
import { createSupabaseStore } from "../src/data/supabase-store";

const [command, email] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (command !== "signin" && command !== "demo") fail("Use: npm run signin -- you@example.com, or npm run demo -- you@example.com");
if (!email || !email.includes("@")) fail(`Add your email after --, for example: npm run ${command} -- you@example.com`);
if (!url || !anonKey || !serviceKey) {
  fail("Missing keys. Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);

async function ensureOrganiser(address: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === address.toLowerCase());
    if (found) return;
    if (data.users.length < 200) break;
  }
  const { error } = await admin.auth.admin.createUser({ email: address, email_confirm: true });
  if (error) throw error;
  console.log(`Made a new organiser account for ${address}.`);
}

async function tokenHash(address: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: address });
  if (error) throw error;
  return data.properties.hashed_token;
}

/** A link that signs you in through the app's own callback. It works once, in any browser, for about an hour. */
async function signInLink(address: string, next: string) {
  return `${appUrl}/auth/callback?token_hash=${await tokenHash(address)}&type=magiclink&next=${encodeURIComponent(next)}`;
}

/** The organiser's own data layer, signed in as them, so the demo is theirs and passes the same rules. */
async function organiserStore(address: string) {
  const client: SupabaseClient = createClient(url!, anonKey!, options);
  const { error } = await client.auth.verifyOtp({ token_hash: await tokenHash(address), type: "magiclink" });
  if (error) throw error;
  return createSupabaseStore(client);
}

const LEADERS = ["Alex", "Ben", "Chris", "Dan", "Eli", "Felix", "Gabe", "Hugo", "Ivan", "Jon", "Kai", "Leo"];
const FOLLOWERS = ["Amy", "Bea", "Cleo", "Dina", "Eva", "Fay", "Gia", "Hana", "Iris", "Jade", "Kim", "Lia"];

async function makeDemo(address: string) {
  const store = await organiserStore(address);
  const stamp = new Date().toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const contest = await store.createContest(`Demo Jack & Jill (${stamp})`);
  const prelim = await store.addRound(contest.id, "prelim");
  const final = await store.addRound(contest.id, "final");

  const leaders = LEADERS.map((_, i) => String(i + 1));
  const followers = FOLLOWERS.map((_, i) => String(101 + i));
  await store.addCompetitors(contest.id, [
    ...leaders.map((bib, i) => ({ bib, role: "leader" as const, name: LEADERS[i] })),
    ...followers.map((bib, i) => ({ bib, role: "follower" as const, name: FOLLOWERS[i] }))
  ]);
  await store.updateRoundSettings(prelim.id, { maxPerHeat: 5 });
  await store.saveHeats(prelim.id, buildHeats({ leaders, followers, maxPerHeat: 5 }));

  const panel = [
    { name: "Chief", assignment: "both" as const, isChief: true },
    { name: "Lee (leaders)", assignment: "leaders" as const },
    { name: "Lou (leaders)", assignment: "leaders" as const },
    { name: "Fern (followers)", assignment: "followers" as const },
    { name: "Fox (followers)", assignment: "followers" as const }
  ];
  const links: Array<[string, string]> = [];
  for (const judge of panel) {
    const saved = await store.addJudge(prelim.id, judge);
    const { token } = await store.createAccessLink(prelim.id, { kind: "judge", judgeId: saved.id });
    links.push([judge.isChief ? "Chief judge" : `Judge ${judge.name}`, `${appUrl}${accessLinkPath(token)}`]);
  }
  const emcee = await store.createAccessLink(prelim.id, { kind: "emcee" });
  links.push(["Emcee", `${appUrl}${accessLinkPath(emcee.token)}`]);

  // Each judge marks 6 Yes and 2 Alternates. The chief judge can change this on their "Counts and cut" tab.
  const chiefToken = links[0][1].split("/l/")[1];
  await createSupabaseAccess(createClient(url!, anonKey!, options)).setCallbackCounts(chiefToken, 6, 2);

  const organiserLink = await signInLink(address, `/contests/${contest.id}/rounds/${prelim.id}`);
  const lines = [
    `Demo contest: ${contest.name}`,
    `12 leaders (bibs 1 to 12) and 12 followers (bibs 101 to 112), 5 per heat, 6 Yes and 2 Alternates per judge.`,
    `The final is added but empty: set its panel and couples on the organiser screens after the cut.`,
    "",
    `Organiser (signs you in, works once): ${organiserLink}`,
    "",
    "Prelim private links (open each in a different browser, a private window or a phone on the same Wi-Fi):",
    ...links.map(([who, link]) => `  ${who}: ${link}`),
    "",
    `Final round id: ${final.id}`
  ];
  return lines;
}

async function main() {
  await ensureOrganiser(email);
  const lines = command === "signin" ? [`Sign-in link (works once, for about an hour): ${await signInLink(email, "/contests")}`] : await makeDemo(email);
  const text = lines.join("\n");
  writeFileSync("demo-links.txt", `${text}\n`);
  console.log(`\n${text}\n\nSaved to demo-links.txt. Keep it private: anyone with a link can use it.\n`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
