import { describe, expect, it } from "vitest";
import { buildHeats } from "./heats";

const bibs = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

describe("buildHeats", () => {
  it("makes 4 heats for 70 leaders and 80 followers at 20 per heat, topping up the short last heat with redancers", () => {
    const heats = buildHeats({ leaders: bibs(1, 70), followers: bibs(101, 180), maxPerHeat: 20 });
    expect(heats).toHaveLength(4);
    expect(heats.map((h) => h.leaders.length)).toEqual([20, 20, 20, 20]);
    expect(heats.map((h) => h.followers.length)).toEqual([20, 20, 20, 20]);

    const last = heats[3];
    expect(last.leaders.filter((s) => !s.redancer).map((s) => s.bib)).toEqual(bibs(61, 70));
    expect(last.leaders.filter((s) => s.redancer).map((s) => s.bib)).toEqual(bibs(1, 10));
    expect(last.followers.some((s) => s.redancer)).toBe(false);
  });

  it("fills heats in bib order, even when bibs are given out of order", () => {
    const heats = buildHeats({ leaders: ["10", "2", "1"], followers: ["30", "20"], maxPerHeat: 2 });
    expect(heats[0].leaders.map((s) => s.bib)).toEqual(["1", "2"]);
    expect(heats[1].leaders.filter((s) => !s.redancer).map((s) => s.bib)).toEqual(["10"]);
  });

  it("judges every dancer exactly once and never lists a dancer twice in one heat", () => {
    const heats = buildHeats({ leaders: bibs(1, 30), followers: bibs(101, 180), maxPerHeat: 20 });
    expect(heats).toHaveLength(4);
    const judged = heats.flatMap((h) => h.leaders.filter((s) => !s.redancer).map((s) => s.bib));
    expect(judged.sort()).toEqual(bibs(1, 30).sort());
    for (const heat of heats) {
      expect(heat.leaders).toHaveLength(20);
      expect(new Set(heat.leaders.map((s) => s.bib)).size).toBe(20);
    }
  });

  it("spreads redancers so nobody redances twice before everyone has redanced once", () => {
    const heats = buildHeats({ leaders: bibs(1, 30), followers: bibs(101, 180), maxPerHeat: 20 });
    const counts = new Map<string, number>(bibs(1, 30).map((bib) => [bib, 0]));
    for (const heat of heats) for (const s of heat.leaders) if (s.redancer) counts.set(s.bib, counts.get(s.bib)! + 1);
    // 50 redancer slots over 30 leaders: everyone redances at least once, nobody more than twice.
    expect(Math.min(...counts.values())).toBe(1);
    expect(Math.max(...counts.values())).toBe(2);
  });

  it("uses one heat with no redancers when a role has fewer dancers than a heat holds", () => {
    const heats = buildHeats({ leaders: bibs(1, 15), followers: bibs(101, 118), maxPerHeat: 20 });
    expect(heats).toHaveLength(1);
    expect(heats[0].leaders).toHaveLength(15);
    expect(heats[0].followers).toHaveLength(18);
    expect(heats[0].leaders.some((s) => s.redancer)).toBe(false);
  });

  it("returns no heats when nobody signed up", () => {
    expect(buildHeats({ leaders: [], followers: [], maxPerHeat: 20 })).toEqual([]);
  });

  it("rejects a heat size that is not a whole number of one or more", () => {
    expect(() => buildHeats({ leaders: ["1"], followers: ["2"], maxPerHeat: 0 })).toThrow();
    expect(() => buildHeats({ leaders: ["1"], followers: ["2"], maxPerHeat: 2.5 })).toThrow();
  });
});
