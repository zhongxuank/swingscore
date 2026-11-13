import { describe, expect, it } from "vitest";
import type { AccessView } from "@/data/access";
import { buildRoleSheet, sheetMarks, submitProblems, tapToTenths } from "./judge-sheet";

const view = {
  competitors: [
    { id: "l1", bib: "1", role: "leader", name: "" },
    { id: "l2", bib: "2", role: "leader", name: "" },
    { id: "l3", bib: "3", role: "leader", name: "" }
  ],
  heats: [
    { role: "leader", heatNumber: 2, slot: 1, competitorId: "l3", redancer: false },
    { role: "leader", heatNumber: 2, slot: 2, competitorId: "l1", redancer: true },
    { role: "leader", heatNumber: 1, slot: 2, competitorId: "l2", redancer: false },
    { role: "leader", heatNumber: 1, slot: 1, competitorId: "l1", redancer: false }
  ]
} as unknown as AccessView;

describe("judge sheet", () => {
  it("turns a tap position into tenths, clamped to the row", () => {
    expect(tapToTenths(150, 300)).toBe(500);
    expect(tapToTenths(-5, 300)).toBe(0);
    expect(tapToTenths(400, 300)).toBe(1000);
    expect(tapToTenths(100, 300)).toBe(333);
  });

  it("lists heats with redancers and every dancer once", () => {
    const sheet = buildRoleSheet(view, "leader");
    expect(sheet.heats.map((h) => h.rows.map((r) => `${r.bib}${r.redancer ? "R" : ""}`))).toEqual([["1", "2"], ["3", "1R"]]);
    expect(sheet.dancers.map((d) => `${d.bib}@${d.heatNumber}`)).toEqual(["1@1", "2@1", "3@2"]);
  });

  it("colours by Yes and Alternate counts and blocks submission on missing scores and boundary ties", () => {
    const sheet = buildRoleSheet(view, "leader");
    const scores = new Map([["l1", 900], ["l2", 800]]);
    const marks = sheetMarks(sheet, scores, 1, 1);
    expect(marks.status.get("l1")).toBe("yes");
    expect(marks.status.get("l2")).toBe("alt");
    expect(submitProblems(sheet, scores, marks, false)).toEqual(["1 dancer still needs a score."]);

    const tied = new Map([["l1", 900], ["l2", 900], ["l3", 100]]);
    const tiedMarks = sheetMarks(sheet, tied, 1, 1);
    expect(submitProblems(sheet, tied, tiedMarks, false)).toEqual(["Equal scores across a callback boundary: 1, 2."]);
    expect(submitProblems(sheet, tied, tiedMarks, true)).toEqual(["Chief judge scores cannot tie: 1, 2."]);
  });

  it("lets a regular judge tie inside one band", () => {
    const sheet = buildRoleSheet(view, "leader");
    const scores = new Map([["l1", 900], ["l2", 100], ["l3", 100]]);
    expect(submitProblems(sheet, scores, sheetMarks(sheet, scores, 1, 0), false)).toEqual([]);
  });
});
