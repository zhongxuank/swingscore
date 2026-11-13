import { describe, expect, it } from "vitest";
import { parseCompetitorLines } from "./parse-competitors";

describe("parseCompetitorLines", () => {
  it("reads bib, role and name separated by spaces, commas or tabs", () => {
    const { competitors, problems } = parseCompetitorLines("101 L Ann Lee\n201, follower, Bo\n\n102\tLead\n");
    expect(problems).toEqual([]);
    expect(competitors).toEqual([
      { bib: "101", role: "leader", name: "Ann Lee" },
      { bib: "201", role: "follower", name: "Bo" },
      { bib: "102", role: "leader", name: "" }
    ]);
  });

  it("uses the default role for lines without one", () => {
    expect(parseCompetitorLines("7\n8 Cy Dee", "follower").competitors).toEqual([
      { bib: "7", role: "follower", name: "" },
      { bib: "8", role: "follower", name: "Cy Dee" }
    ]);
  });

  it("reports lines with no role when there is no default", () => {
    const { competitors, problems } = parseCompetitorLines("7 L\n8 Cy");
    expect(competitors).toHaveLength(1);
    expect(problems).toEqual(['Line 2 ("8 Cy") needs a role: L or F after the bib.']);
  });
});
