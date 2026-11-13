import { describe, expect, it } from "vitest";
import { buildDraw, validateCouples } from "./draw";

const leaders = ["1", "2", "3", "4"];
const followers = ["11", "12", "13", "14"];
const pairs = (draw: ReturnType<typeof buildDraw>) => draw.map((c) => `${c.leader}-${c.follower}`);

describe("buildDraw", () => {
  it("pairs in line with no shift", () => {
    expect(pairs(buildDraw({ leaders, followers, followerOrder: "ascending", direction: "right", shift: 0 }))).toEqual(["1-11", "2-12", "3-13", "4-14"]);
  });

  it("shifts the followers one way for right and the other for left", () => {
    const right = buildDraw({ leaders, followers, followerOrder: "ascending", direction: "right", shift: 1 });
    const left = buildDraw({ leaders, followers, followerOrder: "ascending", direction: "left", shift: 1 });
    expect(pairs(right)).toEqual(["1-12", "2-13", "3-14", "4-11"]);
    expect(pairs(left)).toEqual(["1-14", "2-11", "3-12", "4-13"]);
  });

  it("wraps the shift around the line", () => {
    expect(pairs(buildDraw({ leaders, followers, followerOrder: "ascending", direction: "right", shift: 5 }))).toEqual(["1-12", "2-13", "3-14", "4-11"]);
  });

  it("lists followers in descending bib order when flipped", () => {
    expect(pairs(buildDraw({ leaders, followers, followerOrder: "descending", direction: "right", shift: 0 }))).toEqual(["1-14", "2-13", "3-12", "4-11"]);
    expect(pairs(buildDraw({ leaders, followers, followerOrder: "descending", direction: "right", shift: 2 }))).toEqual(["1-12", "2-11", "3-14", "4-13"]);
  });

  it("orders by bib number, not as text, and keeps leaders in ascending order", () => {
    const draw = buildDraw({ leaders: ["10", "9", "2"], followers: ["30", "100", "20"], followerOrder: "ascending", direction: "right", shift: 0 });
    expect(pairs(draw)).toEqual(["2-20", "9-30", "10-100"]);
  });

  it("rejects unequal numbers of leaders and followers", () => {
    expect(() => buildDraw({ leaders, followers: ["11"], followerOrder: "ascending", direction: "right", shift: 0 })).toThrow(/same number/);
  });

  it("rejects a shift that is not a whole number", () => {
    expect(() => buildDraw({ leaders, followers, followerOrder: "ascending", direction: "right", shift: 1.5 })).toThrow();
  });
});

describe("validateCouples", () => {
  const good = [{ leader: "1", follower: "11" }, { leader: "2", follower: "12" }];

  it("accepts a complete set of couples", () => {
    expect(validateCouples(good, ["1", "2"], ["11", "12"])).toEqual([]);
  });

  it("reports a follower used twice and a dancer left out", () => {
    const edited = [{ leader: "1", follower: "11" }, { leader: "2", follower: "11" }];
    expect(validateCouples(edited, ["1", "2"], ["11", "12"])).toEqual(["Follower 11 is paired more than once.", "Follower 12 has no partner."]);
  });

  it("reports a bib that is not in the contest", () => {
    const edited = [{ leader: "1", follower: "11" }, { leader: "9", follower: "12" }];
    expect(validateCouples(edited, ["1", "2"], ["11", "12"])).toEqual(["Leader 9 is not in this contest.", "Leader 2 has no partner."]);
  });
});
