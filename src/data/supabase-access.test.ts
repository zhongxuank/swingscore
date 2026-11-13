import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { buildHeats } from "@/core/heats";
import { createSupabaseAccess } from "./supabase-access";
import { createSupabaseStore } from "./supabase-store";

/* Ticket 4 "done when": a link opens only its own round and role, and a wrong or edited token shows nothing. Live only. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = process.env.SUPABASE_LIVE_TESTS === "1" && Boolean(url && anonKey && serviceKey);
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const users: string[] = [];

async function organiserStore() {
  const admin = createClient(url!, serviceKey!, noSession);
  const email = `swingscore-test-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url!, anonKey!, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return createSupabaseStore(client);
}

async function setUp() {
  const store = await organiserStore();
  const contest = await store.createContest("Novice");
  const prelim = await store.addRound(contest.id, "prelim");
  const other = await store.addRound(contest.id, "final");
  await store.addCompetitors(contest.id, [
    { bib: "1", role: "leader", name: "Ann" },
    { bib: "2", role: "leader", name: "Al" },
    { bib: "101", role: "follower", name: "Bo" }
  ]);
  await store.saveHeats(prelim.id, buildHeats({ leaders: ["1", "2"], followers: ["101"], maxPerHeat: 2 }));
  const lee = await store.addJudge(prelim.id, { name: "Lee", assignment: "leaders" });
  const cat = await store.addJudge(prelim.id, { name: "Cat", assignment: "both", isChief: true });
  const finalJudge = await store.addJudge(other.id, { name: "Fin", assignment: "both" });
  const competitors = await store.listCompetitors(contest.id);
  const id = (bib: string) => competitors.find((c) => c.bib === bib)!.id;
  return {
    store,
    prelim,
    id,
    lee: (await store.createAccessLink(prelim.id, { kind: "judge", judgeId: lee.id })).token,
    cat: (await store.createAccessLink(prelim.id, { kind: "judge", judgeId: cat.id })).token,
    emcee: (await store.createAccessLink(prelim.id, { kind: "emcee" })).token,
    final: (await store.createAccessLink(other.id, { kind: "judge", judgeId: finalJudge.id })).token
  };
}

describe.skipIf(!live)("private links (live)", { timeout: 60_000 }, () => {
  const access = () => createSupabaseAccess(createClient(url!, anonKey!, noSession));

  afterAll(async () => {
    const admin = createClient(url!, serviceKey!, noSession);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it("opens only its own round and role, and a wrong, edited or replaced token shows nothing", async () => {
    const { store, prelim, lee, emcee, final } = await setUp();
    const view = await access().load(lee);
    expect(view).toMatchObject({ kind: "judge", round: { id: prelim.id, stage: "prelim" }, judge: { name: "Lee" }, roles: ["leader"] });
    expect(view!.competitors.map((c) => [c.bib, c.name])).toEqual(expect.arrayContaining([["1", ""], ["2", ""]]));
    expect(view!.competitors).toHaveLength(2);
    expect(view!.heats.every((slot) => slot.role === "leader")).toBe(true);

    const emceeView = await access().load(emcee);
    expect(emceeView!.competitors).toHaveLength(3);
    expect(emceeView!.competitors.map((c) => c.name)).toContain("Bo");

    expect((await access().load(final))!.round.stage).toBe("final");
    expect(await access().load("")).toBeNull();
    expect(await access().load(`${lee.slice(0, -1)}${lee.endsWith("A") ? "B" : "A"}`)).toBeNull();

    const judges = await store.listJudges(prelim.id);
    await store.createAccessLink(prelim.id, { kind: "judge", judgeId: judges.find((j) => j.name === "Lee")!.id });
    expect(await access().load(lee)).toBeNull();
  });

  it("saves scores in change order and submits a full sheet", async () => {
    const { lee, cat, id, emcee } = await setUp();
    const a = access();
    await a.saveScore(lee, id("1"), 875, "2026-11-13T10:00:05Z");
    await a.saveScore(lee, id("1"), 500, "2026-11-13T10:00:00Z");
    await expect(a.saveScore(lee, id("101"), 800, "2026-11-13T10:00:00Z")).rejects.toMatchObject({ code: "invalid" });
    await expect(a.saveScore(emcee, id("1"), 800, "2026-11-13T10:00:00Z")).rejects.toMatchObject({ code: "not_found" });
    await expect(a.submitSheet(lee, "leader")).rejects.toMatchObject({ code: "invalid" });
    await a.saveScore(lee, id("2"), 875, "2026-11-13T10:00:06Z");
    await a.submitSheet(lee, "leader");

    const view = await a.load(lee);
    expect(view!.scores.find((s) => s.competitorId === id("1"))!.tenths).toBe(875);
    expect(view!.submitted).toEqual(["leader"]);
    await expect(a.saveScore(lee, id("2"), 100, "2026-11-13T11:00:00Z")).rejects.toMatchObject({ code: "invalid" });

    await a.saveScore(cat, id("1"), 900, "2026-11-13T10:00:00Z");
    await a.saveScore(cat, id("2"), 900, "2026-11-13T10:00:00Z");
    await expect(a.submitSheet(cat, "leader")).rejects.toThrow(/cannot tie/);
  });
});
