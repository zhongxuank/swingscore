import type { AccessLink, AccessRole, Judge, JudgeAssignmentRole, RoundConfig } from "@/lib/types";
import { roleAssignmentLabel } from "@/lib/data/demo-data";
import { chiefJudgeCountsForRound, scoringMethodLabel } from "@/lib/rounds";

const tokenPrefix = "swingscore";
const tokenSeparator = "__";

export interface RoundAccessLink extends AccessLink {
  id: string;
  competitionId: string;
  roundId: string;
  judgeId?: string;
  roleAssignment?: JudgeAssignmentRole;
  displayName: string;
  messageRole: string;
  description: string;
}

export interface ParsedRoundAccessToken {
  role: AccessRole;
  competitionId: string;
  roundId: string;
  subjectId: string;
  roleAssignment?: JudgeAssignmentRole;
}

export function buildRoundAccessLinks({
  competitionId,
  round,
  judges,
  judgeAssignments
}: {
  competitionId: string;
  round: RoundConfig;
  judges: Judge[];
  judgeAssignments: Record<string, JudgeAssignmentRole>;
}): RoundAccessLink[] {
  const judgeLinks = judges
    .filter((judge) => !judge.isChiefJudge)
    .map((judge): RoundAccessLink => {
      const assignment = judgeAssignments[judge.id] ?? judge.roleAssignment;
      const token = createRoundAccessToken({
        role: "judge",
        competitionId,
        roundId: round.id,
        subjectId: judge.id,
        roleAssignment: assignment
      });
      return {
        id: `judge-${judge.id}`,
        token,
        role: "judge",
        label: `${judge.name} - ${roleAssignmentLabel(assignment)}`,
        href: `/judge/${token}`,
        competitionId,
        roundId: round.id,
        judgeId: judge.id,
        roleAssignment: assignment,
        displayName: judge.name,
        messageRole: judgeAssignmentMessageLabel(assignment),
        description: `${scoringMethodLabel(round.scoringMethod)} sheet`
      };
    });

  const chiefJudge = judges.find((judge) => judge.isChiefJudge);
  const chiefJudgeCounts = chiefJudgeCountsForRound(round);
  const chiefLink = chiefJudge
    ? [
        makeServiceLink({
          id: "chief-chief",
          role: "chief" as const,
          competitionId,
          round,
          subjectId: chiefJudge.id,
          label: chiefJudgeCounts ? `${chiefJudge.name} - Chief Judge scoring counts` : `${chiefJudge.name} - Chief Judge review`,
          displayName: chiefJudge.name,
          messageRole: "Chief Judge",
          description: chiefJudgeCounts
            ? "Raw scores included in normal scoring"
            : round.scoringMethod === "relative_placement"
              ? "Final review and panel oversight"
              : "Raw tiebreak scoring and boundary review"
        })
      ]
    : [];

  const emceeLink = makeServiceLink({
    id: "emcee-emcee",
    role: "emcee",
    competitionId,
    round,
    subjectId: "emcee",
    label: "Emcee",
    displayName: "Emcee",
    messageRole: "Emcee",
    description: "Read-only announcements, heats, callbacks, and placements"
  });

  return [...judgeLinks, ...chiefLink, emceeLink];
}

export function createRoundAccessToken({
  role,
  competitionId,
  roundId,
  subjectId,
  roleAssignment
}: {
  role: AccessRole;
  competitionId: string;
  roundId: string;
  subjectId: string;
  roleAssignment?: JudgeAssignmentRole;
}) {
  return [tokenPrefix, role, competitionId, roundId, subjectId, roleAssignment ?? ""].map(encodeSegment).join(tokenSeparator);
}

export function parseRoundAccessToken(token: string): ParsedRoundAccessToken | null {
  const [prefix, role, competitionId, roundId, subjectId, roleAssignment] = token.split(tokenSeparator).map(decodeSegment);
  if (prefix !== tokenPrefix || !isAccessRole(role) || !competitionId || !roundId || !subjectId) return null;
  return {
    role,
    competitionId,
    roundId,
    subjectId,
    roleAssignment: isJudgeAssignmentRole(roleAssignment) ? roleAssignment : undefined
  };
}

function makeServiceLink({
  id,
  role,
  competitionId,
  round,
  subjectId,
  label,
  displayName,
  messageRole,
  description
}: {
  id: string;
  role: "chief" | "emcee";
  competitionId: string;
  round: RoundConfig;
  subjectId: string;
  label: string;
  displayName: string;
  messageRole: string;
  description: string;
}): RoundAccessLink {
  const token = createRoundAccessToken({ role, competitionId, roundId: round.id, subjectId });
  return {
    id,
    token,
    role,
    label,
    href: `/${role}/${token}`,
    competitionId,
    roundId: round.id,
    displayName,
    messageRole,
    description
  };
}

export function judgeAssignmentMessageLabel(assignment: JudgeAssignmentRole) {
  if (assignment === "leaders") return "Leader";
  if (assignment === "followers") return "Follower";
  return "Leader/Follower";
}

function encodeSegment(value: string) {
  return encodeURIComponent(value);
}

function decodeSegment(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isAccessRole(value: string): value is AccessRole {
  return value === "judge" || value === "chief" || value === "emcee" || value === "admin";
}

function isJudgeAssignmentRole(value: string): value is JudgeAssignmentRole {
  return value === "leaders" || value === "followers" || value === "both";
}
