import { describe, expect, it } from "vitest";
import { countedJudges, validatePanel, type Panel } from "./panel";

const judge = (id: string, assignment: "leaders" | "followers" | "both") => ({ id, name: `Judge ${id}`, assignment });

const prelimPanel: Panel = {
  judges: [judge("l1", "leaders"), judge("l2", "leaders"), judge("l3", "leaders"), judge("f1", "followers"), judge("f2", "followers"), judge("f3", "followers")],
  chiefJudge: { name: "Zee" },
  chiefJudgeCounts: false
};

describe("countedJudges", () => {
  it("returns each role's judges, with 'both' judges in both roles", () => {
    const panel: Panel = { ...prelimPanel, judges: [...prelimPanel.judges, judge("b1", "both")] };
    expect(countedJudges(panel, "leaders").map((j) => j.id)).toEqual(["l1", "l2", "l3", "b1"]);
    expect(countedJudges(panel, "followers").map((j) => j.id)).toEqual(["f1", "f2", "f3", "b1"]);
  });

  it("adds the chief judge to both roles only when their score counts", () => {
    expect(countedJudges(prelimPanel, "leaders")).toHaveLength(3);
    expect(countedJudges({ ...prelimPanel, chiefJudgeCounts: true }, "leaders")).toHaveLength(4);
  });
});

describe("validatePanel for a callback round", () => {
  it("accepts 3 judges per role and a chief judge", () => {
    expect(validatePanel("callback", prelimPanel)).toEqual([]);
  });

  it("needs a chief judge and at least one judge per role", () => {
    expect(validatePanel("callback", { ...prelimPanel, chiefJudge: null })).toContain("Add a chief judge.");
    const noFollowers: Panel = { ...prelimPanel, judges: prelimPanel.judges.filter((j) => j.assignment === "leaders") };
    expect(validatePanel("callback", noFollowers)).toContain("Add at least one judge for followers.");
  });

  it("rejects blank names", () => {
    const blank: Panel = { ...prelimPanel, judges: [{ id: "x", name: "  ", assignment: "both" }, ...prelimPanel.judges] };
    expect(validatePanel("callback", blank)).toContain("Every judge needs a name.");
  });
});

describe("validatePanel for a final", () => {
  const finalists = (count: number): Panel => ({
    judges: Array.from({ length: count }, (_, i) => judge(`j${i}`, "both")),
    chiefJudge: { name: "Zee" },
    chiefJudgeCounts: false
  });

  it("accepts 5 and 7 scoring judges", () => {
    expect(validatePanel("final", finalists(5))).toEqual([]);
    expect(validatePanel("final", finalists(7))).toEqual([]);
  });

  it("rejects an even counted panel and fewer than 3", () => {
    expect(validatePanel("final", finalists(6))).toContain("The counted panel must be an odd number of judges. It has 6.");
    expect(validatePanel("final", finalists(1))).toContain("A final needs at least 3 counted judges. It has 1.");
  });

  it("counts the chief judge toward the odd total only when their score counts", () => {
    expect(validatePanel("final", { ...finalists(6), chiefJudgeCounts: true })).toEqual([]);
    expect(validatePanel("final", { ...finalists(5), chiefJudgeCounts: true })).toContain(
      "The counted panel must be an odd number of judges. It has 6."
    );
  });
});
