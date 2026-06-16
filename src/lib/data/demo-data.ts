import type { Competition, Competitor, Couple, HeatEntry, Judge, JudgeAssignmentRole, RawScore, Role, RoundConfig } from "@/lib/types";
import { generateHeatEntries } from "@/lib/rounds";

export const demoCompetition: Competition = {
  id: "demo-novice-jj",
  name: "Novice Jack and Jill",
  division: "Novice",
  kind: "contest",
  status: "running",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-16T08:30:00.000Z"
};

export const demoCompetitions: Competition[] = [
  demoCompetition,
  {
    id: "demo-intermediate-jj",
    name: "Intermediate Jack and Jill",
    division: "Intermediate",
    kind: "contest",
    status: "draft",
    createdAt: "2026-06-16T02:00:00.000Z",
    updatedAt: "2026-06-16T02:20:00.000Z"
  },
  {
    id: "demo-archived-masters",
    name: "Masters Jack and Jill",
    division: "Masters",
    kind: "contest",
    status: "finalized",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T12:30:00.000Z",
    archivedAt: "2026-05-02T10:00:00.000Z"
  }
];

export const demoRound: RoundConfig = {
  id: "round-prelims",
  competitionId: demoCompetition.id,
  name: "Prelims",
  stage: "prelim",
  scoringMethod: "callback",
  status: "running",
  order: 1,
  requiredYeses: 4,
  requiredAlts: 3,
  advancementCount: 6,
  leaderChiefJudgeMode: "tiebreak_only",
  followerChiefJudgeMode: "tiebreak_only",
  startedAt: "2026-06-16T08:30:00.000Z",
  setupLockedAt: "2026-06-16T08:30:00.000Z",
  judgePanelConfirmedAt: "2026-06-16T08:20:00.000Z"
};

export const demoFinalRound: RoundConfig = {
  id: "round-finals",
  competitionId: demoCompetition.id,
  name: "Finals",
  stage: "final",
  scoringMethod: "relative_placement",
  status: "draft",
  order: 2,
  requiredYeses: 0,
  requiredAlts: 0,
  advancementCount: 0,
  leaderChiefJudgeMode: "none",
  followerChiefJudgeMode: "none",
  chiefJudgeCountsForFinal: false,
  sourceRoundId: demoRound.id,
  judgePanelConfirmedAt: "2026-06-16T08:20:00.000Z"
};

export const demoRounds: RoundConfig[] = [demoRound, demoFinalRound];

export const demoCompetitors: Competitor[] = [
  { id: "L101", bibNumber: "101", preferredName: "Alex", role: "Leader" },
  { id: "L102", bibNumber: "102", preferredName: "Morgan", role: "Leader" },
  { id: "L103", bibNumber: "103", preferredName: "Sam", role: "Leader" },
  { id: "L104", bibNumber: "104", preferredName: "Riley", role: "Leader" },
  { id: "L105", bibNumber: "105", preferredName: "Casey", role: "Leader" },
  { id: "L106", bibNumber: "106", preferredName: "Jordan", role: "Leader" },
  { id: "L107", bibNumber: "107", preferredName: "Taylor", role: "Leader" },
  { id: "L108", bibNumber: "108", preferredName: "Quinn", role: "Leader" },
  { id: "F201", bibNumber: "201", preferredName: "Jamie", role: "Follower" },
  { id: "F202", bibNumber: "202", preferredName: "Avery", role: "Follower" },
  { id: "F203", bibNumber: "203", preferredName: "Drew", role: "Follower" },
  { id: "F204", bibNumber: "204", preferredName: "Sky", role: "Follower" },
  { id: "F205", bibNumber: "205", preferredName: "Blake", role: "Follower" },
  { id: "F206", bibNumber: "206", preferredName: "Reese", role: "Follower" },
  { id: "F207", bibNumber: "207", preferredName: "Rowan", role: "Follower" },
  { id: "F208", bibNumber: "208", preferredName: "Parker", role: "Follower" }
];

export const demoJudges: Judge[] = [
  { id: "judge-1", name: "Judge One", roleAssignment: "leaders" },
  { id: "judge-2", name: "Judge Two", roleAssignment: "followers" },
  { id: "judge-3", name: "Judge Three", roleAssignment: "both" },
  { id: "judge-4", name: "Judge Four", roleAssignment: "both" },
  { id: "chief", name: "Chief Judge", roleAssignment: "both", isChiefJudge: true }
];

export const demoJudgeAccessLinks: Array<{
  token: string;
  href: string;
  label: string;
  judgeId: string;
  roleAssignment: JudgeAssignmentRole;
}> = [
  {
    token: "demo-judge",
    href: "/judge/demo-judge",
    label: "Judge One - Leaders",
    judgeId: "judge-1",
    roleAssignment: "leaders"
  },
  {
    token: "demo-follower",
    href: "/judge/demo-follower",
    label: "Judge Two - Followers",
    judgeId: "judge-2",
    roleAssignment: "followers"
  },
  {
    token: "demo-both",
    href: "/judge/demo-both",
    label: "Judge Three - Both roles",
    judgeId: "judge-3",
    roleAssignment: "both"
  }
];

export const demoJudgeAssignmentStorageKey = "swingscore.demo.judgeAssignments";

export const demoDefaultJudgeAssignments = Object.fromEntries(
  demoJudges.map((judge) => [judge.id, judge.roleAssignment])
) as Record<string, JudgeAssignmentRole>;

export function isJudgeAssignmentRole(value: unknown): value is JudgeAssignmentRole {
  return value === "leaders" || value === "followers" || value === "both";
}

export function roleAssignmentAllows(assignment: JudgeAssignmentRole, role: Role) {
  return assignment === "both" || (assignment === "leaders" && role === "Leader") || (assignment === "followers" && role === "Follower");
}

export function roleAssignmentLabel(assignment: JudgeAssignmentRole) {
  if (assignment === "leaders") return "Leaders";
  if (assignment === "followers") return "Followers";
  return "Leaders and Followers";
}

export const demoHeatEntries: HeatEntry[] = generateHeatEntries({
  competitors: demoCompetitors,
  roundId: demoRound.id,
  maxDancersPerHeat: 4
});

export const demoPrelimScores: RawScore[] = demoJudges
  .filter((judge) => !judge.isChiefJudge)
  .flatMap((judge, judgeIndex) =>
    demoCompetitors.filter((competitor) => roleAssignmentAllows(judge.roleAssignment, competitor.role)).map((competitor, competitorIndex) => {
      const roleOffset = competitor.role === "Leader" ? 0 : 3;
      const seed = 88 - competitorIndex * 1.5 + judgeIndex * 0.5 + roleOffset;
      return {
        judgeId: judge.id,
        subjectId: competitor.id,
        role: competitor.role,
        scoreX2: Math.max(120, Math.round(seed * 2))
      };
    })
  );

export const demoChiefScores: RawScore[] = demoCompetitors.map((competitor, index) => ({
  judgeId: "chief",
  subjectId: competitor.id,
  role: competitor.role,
  scoreX2: Math.max(120, 184 - index * 2),
  isChiefJudge: true
}));

export const demoCouples: Couple[] = [
  { id: "C1", leaderId: "L101", followerId: "F205", danceOrder: 1 },
  { id: "C2", leaderId: "L102", followerId: "F206", danceOrder: 2 },
  { id: "C3", leaderId: "L103", followerId: "F207", danceOrder: 3 },
  { id: "C4", leaderId: "L104", followerId: "F208", danceOrder: 4 },
  { id: "C5", leaderId: "L105", followerId: "F201", danceOrder: 5 },
  { id: "C6", leaderId: "L106", followerId: "F202", danceOrder: 6 }
];

export const demoFinalScores: RawScore[] = demoJudges
  .flatMap((judge, judgeIndex) =>
    demoCouples.map((couple, coupleIndex) => ({
      judgeId: judge.id,
      subjectId: couple.id,
      scoreX2: 196 - coupleIndex * 4 + ((judgeIndex + coupleIndex) % 3),
      isChiefJudge: judge.isChiefJudge
    }))
  );

export const sampleCsv = `BibNumber,PreferredName,Role
101,Alex,Leader
102,Morgan,Leader
201,Jamie,Follower
202,Avery,Follower`;
