"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ListOrdered, Rows3, Search, Trophy } from "lucide-react";
import {
  demoCompetition,
  demoCompetitors,
  demoDefaultJudgeAssignments,
  demoHeatEntries,
  demoJudgeAccessLinks,
  demoJudgeAssignmentStorageKey,
  demoPrelimScores,
  demoRound,
  isJudgeAssignmentRole,
  roleAssignmentAllows,
  roleAssignmentLabel
} from "@/lib/data/demo-data";
import { parseRoundAccessToken } from "@/lib/access-links";
import { readLocalContests, readLocalRounds } from "@/lib/data/local-contest-store";
import type { BoundaryTie, JudgeAssignmentRole, RawScore, Role, SaveState } from "@/lib/types";
import { deriveJudgePrelimMarks } from "@/lib/scoring/prelims";
import { formatScore, validateScoreSheet } from "@/lib/scoring/score-utils";
import {
  AppFrame,
  Panel,
  ScoreSwipeRow,
  StatusPill,
  competitorLabel,
  type ScoreTieHighlight,
  type TieHighlightTone,
  updateScore
} from "@/components/workspaces/shared";

type JudgeView = "heat" | "rank" | "derived" | "name";

const judgeViews: Array<{ id: JudgeView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "heat", label: "Heat", icon: Rows3 },
  { id: "rank", label: "Rank", icon: ListOrdered },
  { id: "derived", label: "Results", icon: Trophy },
  { id: "name", label: "Name", icon: Search }
];

const tieTones: TieHighlightTone[] = ["rose", "sky", "violet", "teal"];

export function JudgeWorkspace({ token }: { token: string }) {
  const parsedAccess = useMemo(() => parseRoundAccessToken(token), [token]);
  const accessLink = useMemo(() => {
    const demoLink = demoJudgeAccessLinks.find((link) => link.token === token);
    if (demoLink) return demoLink;
    if (parsedAccess?.role === "judge") {
      return {
        token,
        href: `/judge/${token}`,
        label: "Judge sheet",
        judgeId: parsedAccess.subjectId,
        roleAssignment: parsedAccess.roleAssignment ?? "both"
      };
    }
    return demoJudgeAccessLinks[0];
  }, [parsedAccess, token]);
  const [accessContext, setAccessContext] = useState<{ contestName: string; roundName: string; scoringLabel: string } | null>(null);
  const [judgeAssignments, setJudgeAssignments] = useState<Record<string, JudgeAssignmentRole>>({ ...demoDefaultJudgeAssignments });
  const [scores, setScores] = useState<RawScore[]>(() => seedScoresForJudge(accessLink.judgeId));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [activeView, setActiveView] = useState<JudgeView>("heat");
  const [submittedRoles, setSubmittedRoles] = useState<Record<Role, boolean>>({ Leader: false, Follower: false });
  const accessAssignment = parsedAccess?.role === "judge" && parsedAccess.roleAssignment ? parsedAccess.roleAssignment : judgeAssignments[accessLink.judgeId] ?? accessLink.roleAssignment;
  const allowedRoles = useMemo<Role[]>(
    () => (["Leader", "Follower"] as Role[]).filter((role) => roleAssignmentAllows(accessAssignment, role)),
    [accessAssignment]
  );
  const [activeRole, setActiveRole] = useState<Role>(() => (roleAssignmentAllows(accessLink.roleAssignment, "Leader") ? "Leader" : "Follower"));
  const activeScores = useMemo(() => scores.filter((score) => score.role === activeRole), [activeRole, scores]);
  const activeCompetitors = useMemo(() => demoCompetitors.filter((competitor) => competitor.role === activeRole), [activeRole]);

  useEffect(() => {
    const stored = window.localStorage.getItem(demoJudgeAssignmentStorageKey);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const nextAssignments = { ...demoDefaultJudgeAssignments };
      for (const [judgeId, assignment] of Object.entries(parsed)) {
        if (isJudgeAssignmentRole(assignment)) {
          nextAssignments[judgeId] = assignment;
        }
      }
      setJudgeAssignments(nextAssignments);
    } catch {
      window.localStorage.removeItem(demoJudgeAssignmentStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!parsedAccess) {
      setAccessContext(null);
      return;
    }

    const contest = readLocalContests().find((item) => item.id === parsedAccess.competitionId);
    const round = readLocalRounds().find((item) => item.id === parsedAccess.roundId);
    setAccessContext({
      contestName: contest?.name ?? parsedAccess.competitionId,
      roundName: round?.name ?? parsedAccess.roundId,
      scoringLabel: round?.scoringMethod === "relative_placement" ? "Final Round" : "Callback Round"
    });
  }, [parsedAccess]);

  useEffect(() => {
    setScores(seedScoresForJudge(accessLink.judgeId));
    setSubmittedRoles({ Leader: false, Follower: false });
    setSaveState("saved");
  }, [accessLink.judgeId]);

  useEffect(() => {
    if (allowedRoles.length > 0 && !allowedRoles.includes(activeRole)) {
      setActiveRole(allowedRoles[0]);
    }
  }, [activeRole, allowedRoles]);

  useEffect(() => {
    if (saveState !== "saving") return;
    const timeout = window.setTimeout(() => setSaveState("saved"), 450);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const activeMarks = useMemo(
    () =>
      deriveJudgePrelimMarks({
        competitors: activeCompetitors,
        scores: activeScores,
        requiredYeses: demoRound.requiredYeses,
        requiredAlts: demoRound.requiredAlts
      }),
    [activeCompetitors, activeScores]
  );

  const activeTieGroups = useMemo(
    () =>
      activeMarks.ties.map((tie, index) => ({
        tie,
        label: `Tie ${index + 1}`,
        tone: tieTones[index % tieTones.length]
      })),
    [activeMarks.ties]
  );
  const tieHighlightsByCompetitor = useMemo(() => {
    const highlights = new Map<string, ScoreTieHighlight>();
    for (const group of activeTieGroups) {
      for (const subjectId of group.tie.subjectIds) {
        if (!highlights.has(subjectId)) {
          highlights.set(subjectId, { label: group.label, tone: group.tone });
        }
      }
    }
    return highlights;
  }, [activeTieGroups]);

  const validationErrors = [
    ...validateScoreSheet(activeScores, false),
    ...activeTieGroups.map((group) => formatTieWarning(activeRole, group.tie, group.label))
  ];
  const statusByCompetitor = useMemo(
    () =>
      new Map(
        activeMarks.marks.map((mark) => [
          mark.competitorId,
          mark.status === "yes" ? "yes" : mark.status === "alt" ? "alt" : "no"
        ] as const)
      ),
    [activeMarks.marks]
  );

  function changeScore(subjectId: string, scoreX2: number) {
    setScores((current) => updateScore(current, subjectId, scoreX2, accessLink.judgeId));
    setSaveState(window.navigator.onLine ? "saving" : "offline");
    setSubmittedRoles((current) => ({ ...current, [activeRole]: false }));
  }

  return (
    <AppFrame
      eyebrow={`Judge link / ${token}`}
      title={accessContext?.contestName ?? demoCompetition.name}
      subtitle={`${accessContext?.roundName ?? demoRound.name} ${accessContext?.scoringLabel ?? "Callback Round"}. Assigned sheet: ${roleAssignmentLabel(accessAssignment)}. Enter raw scores only; callbacks and alternates are calculated per role.`}
      actions={<StatusPill state={saveState} />}
    >
      <div className="mx-auto max-w-3xl">
        <nav className="no-print sticky top-2 z-10 mb-3 grid grid-cols-4 gap-2 rounded-[8px] border border-graphite/15 bg-chalk/95 p-2 shadow-panel backdrop-blur">
          {judgeViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[6px] text-xs font-black ${
                activeView === view.id ? "bg-graphite text-paper" : "bg-paper text-graphite"
              }`}
            >
              <view.icon size={17} />
              {view.label}
            </button>
          ))}
        </nav>

        {allowedRoles.length > 1 ? (
          <div
            data-testid="judge-role-toggle"
            className="no-print mb-3 grid grid-cols-2 gap-1 rounded-[8px] border border-graphite/15 bg-chalk p-1 shadow-sm"
          >
            {(["Leader", "Follower"] as Role[]).map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={activeRole === role}
                onClick={() => setActiveRole(role)}
                className={`min-h-11 rounded-[6px] text-sm font-black ${
                  activeRole === role ? "bg-graphite text-paper" : "bg-paper text-graphite hover:bg-bluepaper"
                }`}
              >
                {rolePlural(role)}
              </button>
            ))}
          </div>
        ) : null}

        <Panel title={`${viewTitle(activeView)} / ${rolePlural(activeRole)}`}>
          {activeView === "heat" ? (
            <HeatScoreList
              role={activeRole}
              scores={activeScores}
              statusByCompetitor={statusByCompetitor}
              tieHighlightsByCompetitor={tieHighlightsByCompetitor}
              onChange={changeScore}
            />
          ) : null}
          {activeView === "rank" ? (
            <RankScoreList
              scores={activeScores}
              statusByCompetitor={statusByCompetitor}
              tieHighlightsByCompetitor={tieHighlightsByCompetitor}
              onChange={changeScore}
            />
          ) : null}
          {activeView === "derived" ? <DerivedList marks={activeMarks.marks} /> : null}
          {activeView === "name" ? (
            <NameScoreList
              role={activeRole}
              scores={activeScores}
              statusByCompetitor={statusByCompetitor}
              tieHighlightsByCompetitor={tieHighlightsByCompetitor}
              onChange={changeScore}
            />
          ) : null}
        </Panel>

        <div data-testid="judge-action-panel" className="no-print mt-3 rounded-[8px] border border-graphite/15 bg-chalk p-3 shadow-sm">
          {validationErrors.length > 0 ? (
            <div data-testid="judge-warning" className="mb-3 rounded-[8px] border border-oxblood/20 bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
              {validationErrors.join(" ")}
            </div>
          ) : null}
          <button
            type="button"
            disabled={validationErrors.length > 0}
            onClick={() => setSubmittedRoles((current) => ({ ...current, [activeRole]: true }))}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-3 text-base font-black text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
          >
            <Check size={19} />
            {submittedRoles[activeRole] ? `${rolePlural(activeRole)} submitted` : `Submit ${rolePlural(activeRole).toLowerCase()} scores`}
          </button>
        </div>
      </div>
    </AppFrame>
  );
}

function HeatScoreList({
  role,
  scores,
  statusByCompetitor,
  tieHighlightsByCompetitor,
  onChange
}: {
  role: Role;
  scores: RawScore[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  tieHighlightsByCompetitor: Map<string, ScoreTieHighlight>;
  onChange: (subjectId: string, scoreX2: number) => void;
}) {
  return (
    <div className="grid gap-4">
      {[1, 2].map((heat) => (
        <section key={heat}>
          <h3 className="mb-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-graphite/55">Heat {heat}</h3>
          <ScoreRows
            scores={scores}
            subjectIds={demoHeatEntries.filter((entry) => entry.heatNumber === heat && entry.role === role).map((entry) => entry.competitorId)}
            statusByCompetitor={statusByCompetitor}
            tieHighlightsByCompetitor={tieHighlightsByCompetitor}
            onChange={onChange}
          />
        </section>
      ))}
    </div>
  );
}

function RankScoreList({
  scores,
  statusByCompetitor,
  tieHighlightsByCompetitor,
  onChange
}: {
  scores: RawScore[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  tieHighlightsByCompetitor: Map<string, ScoreTieHighlight>;
  onChange: (subjectId: string, scoreX2: number) => void;
}) {
  const subjectIds = scores.slice().sort((a, b) => b.scoreX2 - a.scoreX2).map((score) => score.subjectId);
  return (
    <ScoreRows
      scores={scores}
      subjectIds={subjectIds}
      statusByCompetitor={statusByCompetitor}
      tieHighlightsByCompetitor={tieHighlightsByCompetitor}
      onChange={onChange}
      showRank
    />
  );
}

function NameScoreList({
  role,
  scores,
  statusByCompetitor,
  tieHighlightsByCompetitor,
  onChange
}: {
  role: Role;
  scores: RawScore[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  tieHighlightsByCompetitor: Map<string, ScoreTieHighlight>;
  onChange: (subjectId: string, scoreX2: number) => void;
}) {
  const subjectIds = demoCompetitors
    .slice()
    .filter((competitor) => competitor.role === role)
    .sort((a, b) => a.preferredName.localeCompare(b.preferredName))
    .map((competitor) => competitor.id);
  return (
    <ScoreRows
      scores={scores}
      subjectIds={subjectIds}
      statusByCompetitor={statusByCompetitor}
      tieHighlightsByCompetitor={tieHighlightsByCompetitor}
      onChange={onChange}
    />
  );
}

function ScoreRows({
  scores,
  subjectIds,
  statusByCompetitor,
  tieHighlightsByCompetitor,
  onChange,
  showRank = false
}: {
  scores: RawScore[];
  subjectIds: string[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  tieHighlightsByCompetitor: Map<string, ScoreTieHighlight>;
  onChange: (subjectId: string, scoreX2: number) => void;
  showRank?: boolean;
}) {
  return (
    <div className="grid gap-2">
      {subjectIds.map((subjectId, index) => {
        const competitor = demoCompetitors.find((item) => item.id === subjectId);
        const score = scores.find((item) => item.subjectId === subjectId);
        if (!competitor || !score) return null;
        return (
          <ScoreSwipeRow
            key={subjectId}
            competitor={competitor}
            rank={showRank ? index + 1 : undefined}
            scoreX2={score.scoreX2}
            statusTone={score.scoreX2 === 0 ? "neutral" : statusByCompetitor.get(subjectId) ?? "neutral"}
            tieHighlight={tieHighlightsByCompetitor.get(subjectId)}
            onChange={(next) => onChange(subjectId, next)}
          />
        );
      })}
    </div>
  );
}

function DerivedList({
  marks
}: {
  marks: Array<{ competitorId: string; rank: number; status: string; points: number; altLevel?: number }>;
}) {
  return (
    <div className="grid gap-2">
      {marks
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((mark) => {
          const competitor = demoCompetitors.find((item) => item.id === mark.competitorId);
          return (
            <div key={mark.competitorId} className="grid grid-cols-[42px_1fr_82px] items-center gap-3 rounded-[8px] bg-paper px-3 py-2 text-sm">
              <span className="font-mono font-black">{mark.rank}</span>
              <span className="font-bold">{competitorLabel(competitor)}</span>
              <span className="rounded-full bg-bluepaper px-2 py-1 text-center text-xs font-black uppercase">
                {mark.status}{mark.altLevel ? ` ${mark.altLevel}` : ""}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function seedScoresForJudge(judgeId: string): RawScore[] {
  const existingScores = demoPrelimScores.filter((score) => score.judgeId === judgeId);
  return demoCompetitors.map((competitor) => {
    const score = existingScores.find((item) => item.subjectId === competitor.id);
    return score ?? { judgeId, subjectId: competitor.id, role: competitor.role, scoreX2: 0 };
  });
}

function rolePlural(role: Role) {
  return role === "Leader" ? "Leaders" : "Followers";
}

function formatTieWarning(role: Role, tie: BoundaryTie, label: string) {
  const bibs = tie.subjectIds
    .map((subjectId) => demoCompetitors.find((competitor) => competitor.id === subjectId)?.bibNumber ?? subjectId)
    .join(", ");
  const scoreText = tie.score !== undefined ? ` at ${formatScore(tie.score)}` : "";
  return `${label}: ${role} ${tie.kind} boundary tie at ${tie.boundary}${scoreText}; tied bibs ${bibs}.`;
}

function viewTitle(view: JudgeView) {
  if (view === "heat") return "Heat order";
  if (view === "rank") return "Current rank";
  if (view === "derived") return "Derived callbacks";
  return "Name order";
}
