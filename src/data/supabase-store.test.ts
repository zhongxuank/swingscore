import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { runContestStoreContract } from "./store.contract";
import { createSupabaseStore } from "./supabase-store";

/*
 * Runs the store contract against the real Supabase project. Each store gets a fresh throwaway organiser,
 * created with the service role key and deleted afterwards (their contests go with them).
 * Runs only with SUPABASE_LIVE_TESTS=1 (`npm run test:live`) and the keys in the environment.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = process.env.SUPABASE_LIVE_TESTS === "1" && Boolean(url && anonKey && serviceKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const createdUsers: string[] = [];

async function signedInOrganiser(): Promise<SupabaseClient> {
  const admin = createClient(url!, serviceKey!, noSession);
  const email = `swingscore-test-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUsers.push(data.user.id);

  const client = createClient(url!, anonKey!, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return client;
}

describe.skipIf(!live)("Supabase store (live)", { timeout: 30_000 }, () => {
  afterAll(async () => {
    const admin = createClient(url!, serviceKey!, noSession);
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  });

  runContestStoreContract("Supabase", async () => createSupabaseStore(await signedInOrganiser()));

  it("hides one organiser's contests from another", async () => {
    const mine = createSupabaseStore(await signedInOrganiser());
    const theirs = createSupabaseStore(await signedInOrganiser());
    const contest = await mine.createContest("Novice");
    await mine.addRound(contest.id, "prelim");

    expect(await theirs.listContests({ includeArchived: true })).toEqual([]);
    await expect(theirs.getContest(contest.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(theirs.renameContest(contest.id, "Taken")).rejects.toMatchObject({ code: "not_found" });
    await expect(theirs.addRound(contest.id, "final")).rejects.toMatchObject({ code: "not_found" });
    expect((await mine.getContest(contest.id)).name).toBe("Novice");
  });

  it("refuses a signed-out client", async () => {
    const anon = createSupabaseStore(createClient(url!, anonKey!, noSession));
    expect(await anon.listContests()).toEqual([]);
    await expect(anon.createContest("Novice")).rejects.toThrow();
  });
});
