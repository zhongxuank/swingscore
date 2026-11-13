import { describe, expect, it } from "vitest";
import { toOrdinals, type Ordinals } from "./ordinals";
import { relativePlacement } from "./relative-placement";

function sheetsFromRaw(raw: Record<string, number[]>): { ids: string[]; sheets: Ordinals[] } {
  const ids = Object.keys(raw);
  const judgeCount = raw[ids[0]].length;
  const sheets = Array.from({ length: judgeCount }, (_, judge) => {
    const result = toOrdinals(Object.fromEntries(ids.map((id) => [id, Math.round(raw[id][judge] * 10)])));
    if (!result.ok) throw new Error("fixture has equal scores");
    return result.ordinals;
  });
  return { ids, sheets };
}

const order = (result: ReturnType<typeof relativePlacement>) =>
  [...result.placements].sort((a, b) => a.place - b.place).map((p) => p.entryId);

describe("relativePlacement", () => {
  it("reproduces the WSDC paper's 12-couple, 7-judge example (Figure 1 to Figure 7)", () => {
    const { ids, sheets } = sheetsFromRaw({
      "01 Romie": [87.5, 80.0, 93.4, 77.0, 91.0, 70.0, 83.0],
      "02 Marc": [86.3, 86.0, 92.0, 86.0, 91.5, 72.0, 88.0],
      "03 George": [88.5, 82.5, 93.3, 79.0, 92.0, 76.0, 90.0],
      "04 Jack": [90.0, 83.8, 93.5, 90.0, 96.0, 85.0, 95.0],
      "05 Rhett": [86.9, 83.0, 93.1, 85.0, 95.0, 72.4, 86.0],
      "06 Rocky": [86.0, 81.0, 96.5, 78.0, 93.0, 71.0, 81.0],
      "07 Fred": [91.0, 83.5, 97.0, 88.0, 87.0, 71.5, 94.0],
      "08 Barney": [86.4, 82.0, 92.5, 79.5, 92.5, 72.5, 85.0],
      "09 Ricky": [89.0, 85.0, 97.2, 82.0, 94.0, 86.0, 96.0],
      "10 Ken": [86.5, 83.2, 93.2, 82.5, 86.0, 74.0, 89.0],
      "11 Ike": [84.0, 82.3, 92.8, 77.5, 86.5, 70.5, 79.0],
      "12 Ward": [86.7, 81.5, 94.5, 83.0, 91.2, 73.0, 92.0]
    });
    const result = relativePlacement(ids, sheets);
    expect(order(result)).toEqual([
      "04 Jack", "09 Ricky", "07 Fred", "12 Ward", "03 George", "05 Rhett",
      "10 Ken", "02 Marc", "08 Barney", "06 Rocky", "01 Romie", "11 Ike"
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it("breaks a full tie head to head, as in the paper (A 1 2 1 2 3 2 1 against B 2 1 3 1 2 1 2)", () => {
    const sheets: Ordinals[] = [1, 2, 1, 2, 3, 2, 1].map((a, judge) => ({
      A: a,
      B: [2, 1, 3, 1, 2, 1, 2][judge],
      C: [3, 3, 2, 3, 1, 3, 3][judge]
    }));
    const result = relativePlacement(["A", "B", "C"], sheets);
    expect(order(result)).toEqual(["B", "A", "C"]);
    expect(result.unresolved).toEqual([]);
  });

  it("reports a tie the rules cannot break instead of using id order", () => {
    const sheets: Ordinals[] = [
      { A: 1, B: 2, C: 3 },
      { B: 1, C: 2, A: 3 },
      { C: 1, A: 2, B: 3 }
    ];
    const result = relativePlacement(["A", "B", "C"], sheets);
    expect(result.placements.every((p) => p.tied && p.place === 1)).toBe(true);
    expect(result.unresolved).toEqual([{ places: [1, 3], entryIds: expect.arrayContaining(["A", "B", "C"]) }]);
  });

  it("places an entry with a majority of 1st places before one without", () => {
    const sheets: Ordinals[] = [
      { A: 1, B: 2, C: 3 },
      { A: 2, B: 1, C: 3 },
      { A: 3, B: 1, C: 2 },
      { A: 2, B: 1, C: 3 },
      { A: 1, B: 3, C: 2 }
    ];
    expect(order(relativePlacement(["A", "B", "C"], sheets))).toEqual(["B", "A", "C"]);
  });

  it("gives the next entry the place after a tied group", () => {
    const sheets: Ordinals[] = [
      { A: 1, B: 2, C: 3, D: 4 },
      { B: 1, C: 2, A: 3, D: 4 },
      { C: 1, A: 2, B: 3, D: 4 }
    ];
    const result = relativePlacement(["A", "B", "C", "D"], sheets);
    expect(result.placements.find((p) => p.entryId === "D")).toEqual({ entryId: "D", place: 4, tied: false });
  });

  it("rejects a sheet that repeats or omits an ordinal", () => {
    expect(() => relativePlacement(["A", "B"], [{ A: 1, B: 1 }])).toThrow();
    expect(() => relativePlacement(["A", "B"], [{ A: 1 }])).toThrow();
    expect(() => relativePlacement(["A", "B"], [])).toThrow();
  });
});
