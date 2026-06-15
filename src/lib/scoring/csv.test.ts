import { describe, expect, it } from "vitest";
import { parseCompetitorCsv, toCsv } from "@/lib/scoring/csv";

describe("csv utilities", () => {
  it("parses valid competitor imports", () => {
    const result = parseCompetitorCsv("BibNumber,PreferredName,Role\n101,Alex,Leader\n201,Jamie,Follower");
    expect(result.errors).toEqual([]);
    expect(result.competitors).toHaveLength(2);
  });

  it("rejects duplicate bibs", () => {
    const result = parseCompetitorCsv("BibNumber,PreferredName,Role\n101,Alex,Leader\n101,Jamie,Follower");
    expect(result.errors[0]).toContain("duplicate bib");
  });

  it("escapes CSV cells", () => {
    expect(toCsv([{ Name: "Alex, Jr.", Score: 95 }])).toContain('"Alex, Jr."');
  });
});
