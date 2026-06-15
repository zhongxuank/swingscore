import type { Competition, Competitor, Couple, HeatEntry, Judge, RawScore, RoundConfig } from "@/lib/types";

export const demoCompetition: Competition = {
  id: "demo-novice-jj",
  name: "SwingScore Live Alpha",
  division: "Novice Jack and Jill",
  kind: "prelims",
  status: "running",
  createdAt: "2026-06-15T00:00:00.000Z"
};

export const demoRound: RoundConfig = {
  id: "round-prelims",
  competitionId: demoCompetition.id,
  name: "Prelims",
  requiredYeses: 4,
  requiredAlts: 3,
  advancementCount: 6,
  leaderChiefJudgeMode: "tiebreak_only",
  followerChiefJudgeMode: "tiebreak_only"
};

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
  { id: "judge-1", name: "Judge One", roleAssignment: "both" },
  { id: "judge-2", name: "Judge Two", roleAssignment: "both" },
  { id: "judge-3", name: "Judge Three", roleAssignment: "both" },
  { id: "judge-4", name: "Judge Four", roleAssignment: "both" },
  { id: "chief", name: "Chief Judge", roleAssignment: "both", isChiefJudge: true }
];

export const demoHeatEntries: HeatEntry[] = [
  ...demoCompetitors.map((competitor, index) => ({
    id: `heat-${competitor.id}`,
    heatNumber: Math.floor(index % 8) < 4 ? 1 : 2,
    competitorId: competitor.id,
    role: competitor.role,
    isFiller: false
  }))
];

export const demoPrelimScores: RawScore[] = demoJudges
  .filter((judge) => !judge.isChiefJudge)
  .flatMap((judge, judgeIndex) =>
    demoCompetitors.map((competitor, competitorIndex) => {
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
  .filter((judge) => !judge.isChiefJudge)
  .flatMap((judge, judgeIndex) =>
    demoCouples.map((couple, coupleIndex) => ({
      judgeId: judge.id,
      subjectId: couple.id,
      scoreX2: 196 - coupleIndex * 4 + ((judgeIndex + coupleIndex) % 3)
    }))
  );

export const sampleCsv = `BibNumber,PreferredName,Role
101,Alex,Leader
102,Morgan,Leader
201,Jamie,Follower
202,Avery,Follower`;
