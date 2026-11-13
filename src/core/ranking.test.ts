import { describe, expect, it } from "vitest";
import { deriveMarks } from "./callback";
import { applyCut, rankEntries } from "./ranking";

const ids = ["A", "B", "C", "D"];
// Two judges, 1 Yes and 1 Alternate each. A gets Yes+Alt (14.5), B gets Alt+Yes (14.5), C and D trail.
const j1 = deriveMarks({ A: 900, B: 800, C: 700, D: 600 }, 1, 1).marks;
const j2 = deriveMarks({ B: 900, A: 800, C: 700, D: 600 }, 1, 1).marks;

describe("rankEntries", () => {
  it("sums mark points across judges", () => {
    const { rows } = rankEntries(["C", "D"], [j1, j2]);
    expect(rows.map((r) => [r.entryId, r.totalX100])).toEqual([["C", 0], ["D", 0]]);
    const full = rankEntries(ids, [j1, j2]).rows;
    expect(full.find((r) => r.entryId === "A")?.totalX100).toBe(1450);
  });

  it("reports a tie that needs the chief judge when no chief scores exist", () => {
    const { rows, ties } = rankEntries(ids, [j1, j2]);
    expect(rows.slice(0, 2).map((r) => r.rank)).toEqual([1, 1]);
    expect(ties[0]).toMatchObject({ ranks: [1, 2], needsChiefScores: true });
    expect(new Set(ties[0].entryIds)).toEqual(new Set(["A", "B"]));
  });

  it("orders level entries by the chief judge's raw scores", () => {
    const { rows, ties } = rankEntries(ids, [j1, j2], { A: 700, B: 900, C: 500, D: 400 });
    expect(rows.slice(0, 2).map((r) => [r.entryId, r.rank])).toEqual([["B", 1], ["A", 2]]);
    expect(ties.filter((t) => t.ranks[0] <= 2)).toEqual([]);
  });

  it("keeps the points total unchanged by chief judge scores", () => {
    const withChief = rankEntries(ids, [j1, j2], { A: 700, B: 900, C: 500, D: 400 }).rows;
    expect(withChief.find((r) => r.entryId === "A")?.totalX100).toBe(1450);
  });

  it("reports equal chief judge scores as an unresolved tie", () => {
    const { ties } = rankEntries(ids, [j1, j2], { A: 700, B: 700, C: 500, D: 400 });
    expect(ties).toEqual([{ entryIds: expect.arrayContaining(["A", "B"]), ranks: [1, 1], needsChiefScores: false }]);
  });
});

describe("applyCut", () => {
  it("marks advancing, alternate and out entries and can differ from the Yes count", () => {
    const { rows } = rankEntries(ids, [j1, j2], { A: 700, B: 900, C: 500, D: 400 });
    const { statuses, cutTie } = applyCut(rows, 3, 1);
    expect(statuses).toEqual({ B: "advancing", A: "advancing", C: "advancing", D: "alternate" });
    expect(cutTie).toBeNull();
  });

  it("reports entries still tied across the cut line", () => {
    const { rows } = rankEntries(ids, [j1, j2]);
    const { cutTie } = applyCut(rows, 1, 1);
    expect(cutTie && new Set(cutTie)).toEqual(new Set(["A", "B"]));
  });
});
