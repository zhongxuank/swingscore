import { describe, expect, it } from "vitest";
import { buildRoundAccessLinks, parseRoundAccessToken } from "@/lib/access-links";
import type { Judge, RoundConfig } from "@/lib/types";

const round: RoundConfig = {
  id: "qa-round-prelim",
  competitionId: "qa-contest",
  name: "Prelims",
  stage: "prelim",
  scoringMethod: "callback",
  status: "draft",
  order: 1,
  requiredYeses: 3,
  requiredAlts: 2,
  advancementCount: 8,
  leaderChiefJudgeMode: "tiebreak_only",
  followerChiefJudgeMode: "tiebreak_only"
};

const judges: Judge[] = [
  { id: "judge-1", name: "Judge One", roleAssignment: "leaders" },
  { id: "judge-2", name: "Judge Two", roleAssignment: "followers" },
  { id: "chief", name: "Chief Judge", roleAssignment: "both", isChiefJudge: true }
];

describe("round access links", () => {
  it("builds judge, chief, and emcee links for a round", () => {
    const links = buildRoundAccessLinks({
      competitionId: "qa-contest",
      round,
      judges,
      judgeAssignments: { "judge-1": "both", "judge-2": "followers", chief: "both" }
    });

    expect(links.map((link) => link.role)).toEqual(["judge", "judge", "chief", "emcee"]);
    expect(links[0]).toMatchObject({
      id: "judge-judge-1",
      href: expect.stringContaining("/judge/"),
      label: "Judge One - Leaders and Followers",
      roleAssignment: "both",
      displayName: "Judge One",
      messageRole: "Leader/Follower"
    });
  });

  it("labels chief judge links as scoring when callback scores count", () => {
    const links = buildRoundAccessLinks({
      competitionId: "qa-contest",
      round: {
        ...round,
        leaderChiefJudgeMode: "full_panel",
        followerChiefJudgeMode: "full_panel"
      },
      judges,
      judgeAssignments: { "judge-1": "leaders", "judge-2": "followers", chief: "both" }
    });

    expect(links.find((link) => link.role === "chief")).toMatchObject({
      label: "Chief Judge - Chief Judge scoring counts",
      displayName: "Chief Judge",
      messageRole: "Chief Judge",
      description: "Raw scores included in normal scoring"
    });
  });

  it("round-trips generated tokens", () => {
    const [judgeLink] = buildRoundAccessLinks({
      competitionId: "qa-contest",
      round,
      judges,
      judgeAssignments: { "judge-1": "leaders", "judge-2": "followers", chief: "both" }
    });

    expect(parseRoundAccessToken(judgeLink.token)).toEqual({
      role: "judge",
      competitionId: "qa-contest",
      roundId: "qa-round-prelim",
      subjectId: "judge-1",
      roleAssignment: "leaders"
    });
  });
});
